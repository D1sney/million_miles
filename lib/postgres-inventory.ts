import { neon } from "@neondatabase/serverless";
import {
  ENCAR_QUERY,
  ENCAR_SYNC_LIMIT,
  type InventoryCar,
  type InventoryPayload,
  fetchInventoryBatch,
} from "@/lib/encar";

type CatalogQueryInput = {
  page: number;
  brand: string;
  fuel: string;
  yearFrom: number;
  maxPriceManWon: number;
};

type CatalogFilters = {
  brands: string[];
  fuels: string[];
};

type CatalogPagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalFiltered: number;
};

type DatabaseCatalogResult = {
  cars: InventoryCar[];
  inventory: InventoryPayload;
  filters: CatalogFilters;
  pagination: CatalogPagination;
};

type InventoryRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  trim: string;
  year: number;
  mileage_km: number;
  price_krw: number;
  price_label: string;
  source_price_man_won: number;
  source_price_label: string;
  fuel_type: string;
  transmission: string;
  location: string;
  dealer_name: string;
  image_url: string;
  source_url: string;
  source_modified_at: string | Date;
};

type SyncStateRow = {
  key_name: string;
  source_count: number;
  synced_count: number;
  fetched_at: string | Date;
  query: string;
  backfill_offset: number;
  backfill_complete: boolean;
  backfill_batch_size: number;
  recent_refresh_limit: number;
  last_backfill_at: string | Date | null;
  last_refresh_at: string | Date | null;
};

type SyncMode = "status" | "refresh" | "backfill" | "scheduled";

type SyncSummary = {
  mode: SyncMode;
  fetchedAt: string;
  sourceCount: number;
  syncedCount: number;
  batchSize: number;
  batchCars: number;
  backfillOffset: number;
  backfillComplete: boolean;
};

type ScheduledSyncResult = {
  actions: string[];
  state: SyncStateRow;
  inventory: InventoryPayload;
  refresh?: SyncSummary | null;
  backfill?: SyncSummary | null;
};

const SYNC_STATE_KEY = "primary";
const DEFAULT_BACKFILL_BATCH_SIZE = 3000;
const DEFAULT_REFRESH_LIMIT = ENCAR_SYNC_LIMIT;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  return neon(databaseUrl);
}

function formatFetchedLabel(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function rowToCar(row: InventoryRow): InventoryCar {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    model: row.model,
    trim: row.trim,
    year: Number(row.year),
    mileageKm: Number(row.mileage_km),
    mileageLabel: `${new Intl.NumberFormat("en-US").format(Number(row.mileage_km))} km`,
    priceKrw: Number(row.price_krw),
    priceLabel: row.price_label,
    sourcePriceManWon: Number(row.source_price_man_won),
    sourcePriceLabel: row.source_price_label,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    location: row.location,
    dealerName: row.dealer_name,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    sourceModifiedAt: new Date(row.source_modified_at).toISOString(),
  };
}

function normalizeState(row: SyncStateRow): SyncStateRow {
  return {
    ...row,
    backfill_offset: Number(row.backfill_offset ?? 0),
    source_count: Number(row.source_count ?? 0),
    synced_count: Number(row.synced_count ?? 0),
    backfill_batch_size: Number(row.backfill_batch_size ?? DEFAULT_BACKFILL_BATCH_SIZE),
    recent_refresh_limit: Number(row.recent_refresh_limit ?? DEFAULT_REFRESH_LIMIT),
    backfill_complete: Boolean(row.backfill_complete),
  };
}

async function countActiveCars() {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT COUNT(*)::int AS total
      FROM inventory_cars
      WHERE is_active = TRUE
    `,
  )) as Array<{ total: number }>;

  return Number(rows[0]?.total ?? 0);
}

async function ensureTables() {
  const sql = getSql();

  await sql.query(`
    CREATE TABLE IF NOT EXISTS inventory_cars (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      trim TEXT NOT NULL,
      year INTEGER NOT NULL,
      mileage_km INTEGER NOT NULL,
      price_krw INTEGER NOT NULL,
      price_label TEXT NOT NULL,
      source_price_man_won INTEGER NOT NULL,
      source_price_label TEXT NOT NULL,
      fuel_type TEXT NOT NULL,
      transmission TEXT NOT NULL,
      location TEXT NOT NULL,
      dealer_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_modified_at TIMESTAMPTZ NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);

  await sql.query(`
    ALTER TABLE inventory_cars
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await sql.query(`
    ALTER TABLE inventory_cars
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await sql.query(`
    ALTER TABLE inventory_cars
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await sql.query(`
    UPDATE inventory_cars
    SET
      first_seen_at = COALESCE(first_seen_at, synced_at, NOW()),
      last_seen_at = COALESCE(last_seen_at, synced_at, NOW()),
      is_active = COALESCE(is_active, TRUE)
    WHERE first_seen_at IS NULL OR last_seen_at IS NULL OR is_active IS NULL
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS inventory_sync_state (
      key_name TEXT PRIMARY KEY,
      source_count INTEGER NOT NULL,
      synced_count INTEGER NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL,
      query TEXT NOT NULL,
      backfill_offset INTEGER NOT NULL DEFAULT 0,
      backfill_complete BOOLEAN NOT NULL DEFAULT FALSE,
      backfill_batch_size INTEGER NOT NULL DEFAULT ${DEFAULT_BACKFILL_BATCH_SIZE},
      recent_refresh_limit INTEGER NOT NULL DEFAULT ${DEFAULT_REFRESH_LIMIT},
      last_backfill_at TIMESTAMPTZ,
      last_refresh_at TIMESTAMPTZ
    )
  `);

  await sql.query(`
    ALTER TABLE inventory_sync_state
    ADD COLUMN IF NOT EXISTS backfill_offset INTEGER NOT NULL DEFAULT 0
  `);
  await sql.query(`
    ALTER TABLE inventory_sync_state
    ADD COLUMN IF NOT EXISTS backfill_complete BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await sql.query(`
    ALTER TABLE inventory_sync_state
    ADD COLUMN IF NOT EXISTS backfill_batch_size INTEGER NOT NULL DEFAULT ${DEFAULT_BACKFILL_BATCH_SIZE}
  `);
  await sql.query(`
    ALTER TABLE inventory_sync_state
    ADD COLUMN IF NOT EXISTS recent_refresh_limit INTEGER NOT NULL DEFAULT ${DEFAULT_REFRESH_LIMIT}
  `);
  await sql.query(`
    ALTER TABLE inventory_sync_state
    ADD COLUMN IF NOT EXISTS last_backfill_at TIMESTAMPTZ
  `);
  await sql.query(`
    ALTER TABLE inventory_sync_state
    ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ
  `);

  await sql.query(
    `
      INSERT INTO inventory_sync_state (
        key_name, source_count, synced_count, fetched_at, query,
        backfill_offset, backfill_complete, backfill_batch_size, recent_refresh_limit,
        last_backfill_at, last_refresh_at
      )
      VALUES ('primary', 0, 0, NOW(), $1, 0, FALSE, $2, $3, NULL, NULL)
      ON CONFLICT (key_name) DO NOTHING
    `,
    [ENCAR_QUERY, DEFAULT_BACKFILL_BATCH_SIZE, DEFAULT_REFRESH_LIMIT],
  );

  await sql.query(
    `
      UPDATE inventory_sync_state
      SET
        query = COALESCE(NULLIF(query, ''), $1),
        backfill_offset = CASE
          WHEN last_backfill_at IS NULL AND backfill_offset = 0 AND synced_count > 0
            THEN LEAST(COALESCE(synced_count, 0), COALESCE(source_count, 0))
          ELSE COALESCE(
            backfill_offset,
            LEAST(COALESCE(synced_count, 0), COALESCE(source_count, 0))
          )
        END,
        backfill_complete = CASE
          WHEN COALESCE(source_count, 0) > 0 AND COALESCE(synced_count, 0) >= COALESCE(source_count, 0)
            THEN TRUE
          ELSE COALESCE(backfill_complete, FALSE)
        END,
        backfill_batch_size = COALESCE(backfill_batch_size, $2),
        recent_refresh_limit = COALESCE(recent_refresh_limit, $3)
      WHERE key_name = 'primary'
    `,
    [ENCAR_QUERY, DEFAULT_BACKFILL_BATCH_SIZE, DEFAULT_REFRESH_LIMIT],
  );

  await sql.query(`CREATE INDEX IF NOT EXISTS inventory_cars_brand_idx ON inventory_cars (brand)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS inventory_cars_fuel_idx ON inventory_cars (fuel_type)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS inventory_cars_year_idx ON inventory_cars (year DESC)`);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS inventory_cars_price_idx
    ON inventory_cars (source_price_man_won ASC)
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS inventory_cars_modified_idx
    ON inventory_cars (source_modified_at DESC)
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS inventory_cars_active_modified_idx
    ON inventory_cars (is_active, source_modified_at DESC)
  `);
}

async function readSyncState() {
  await ensureTables();

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        key_name,
        source_count,
        synced_count,
        fetched_at,
        query,
        backfill_offset,
        backfill_complete,
        backfill_batch_size,
        recent_refresh_limit,
        last_backfill_at,
        last_refresh_at
      FROM inventory_sync_state
      WHERE key_name = $1
      LIMIT 1
    `,
    [SYNC_STATE_KEY],
  )) as SyncStateRow[];

  if (!rows[0]) {
    throw new Error("Inventory sync state is missing");
  }

  return normalizeState(rows[0]);
}

async function saveSyncState(state: SyncStateRow) {
  const sql = getSql();

  await sql.query(
    `
      INSERT INTO inventory_sync_state (
        key_name,
        source_count,
        synced_count,
        fetched_at,
        query,
        backfill_offset,
        backfill_complete,
        backfill_batch_size,
        recent_refresh_limit,
        last_backfill_at,
        last_refresh_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (key_name) DO UPDATE SET
        source_count = EXCLUDED.source_count,
        synced_count = EXCLUDED.synced_count,
        fetched_at = EXCLUDED.fetched_at,
        query = EXCLUDED.query,
        backfill_offset = EXCLUDED.backfill_offset,
        backfill_complete = EXCLUDED.backfill_complete,
        backfill_batch_size = EXCLUDED.backfill_batch_size,
        recent_refresh_limit = EXCLUDED.recent_refresh_limit,
        last_backfill_at = EXCLUDED.last_backfill_at,
        last_refresh_at = EXCLUDED.last_refresh_at
    `,
    [
      state.key_name,
      state.source_count,
      state.synced_count,
      state.fetched_at,
      state.query,
      state.backfill_offset,
      state.backfill_complete,
      state.backfill_batch_size,
      state.recent_refresh_limit,
      state.last_backfill_at,
      state.last_refresh_at,
    ],
  );
}

async function upsertCars(cars: InventoryCar[], seenAt: string) {
  if (cars.length === 0) {
    return;
  }

  const sql = getSql();
  const payload = JSON.stringify(
    cars.map((car) => ({
      id: car.id,
      title: car.title,
      brand: car.brand,
      model: car.model,
      trim: car.trim,
      year: car.year,
      mileage_km: car.mileageKm,
      price_krw: car.priceKrw,
      price_label: car.priceLabel,
      source_price_man_won: car.sourcePriceManWon,
      source_price_label: car.sourcePriceLabel,
      fuel_type: car.fuelType,
      transmission: car.transmission,
      location: car.location,
      dealer_name: car.dealerName,
      image_url: car.imageUrl,
      source_url: car.sourceUrl,
      source_modified_at: car.sourceModifiedAt,
    })),
  );

  await sql.query(
    `
      INSERT INTO inventory_cars (
        id, title, brand, model, trim, year, mileage_km, price_krw, price_label,
        source_price_man_won, source_price_label, fuel_type, transmission,
        location, dealer_name, image_url, source_url, source_modified_at,
        synced_at, first_seen_at, last_seen_at, is_active
      )
      SELECT
        payload.id,
        payload.title,
        payload.brand,
        payload.model,
        payload.trim,
        payload.year,
        payload.mileage_km,
        payload.price_krw,
        payload.price_label,
        payload.source_price_man_won,
        payload.source_price_label,
        payload.fuel_type,
        payload.transmission,
        payload.location,
        payload.dealer_name,
        payload.image_url,
        payload.source_url,
        payload.source_modified_at,
        $2::timestamptz,
        $2::timestamptz,
        $2::timestamptz,
        TRUE
      FROM jsonb_to_recordset($1::jsonb) AS payload(
        id text,
        title text,
        brand text,
        model text,
        trim text,
        year integer,
        mileage_km integer,
        price_krw integer,
        price_label text,
        source_price_man_won integer,
        source_price_label text,
        fuel_type text,
        transmission text,
        location text,
        dealer_name text,
        image_url text,
        source_url text,
        source_modified_at timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        trim = EXCLUDED.trim,
        year = EXCLUDED.year,
        mileage_km = EXCLUDED.mileage_km,
        price_krw = EXCLUDED.price_krw,
        price_label = EXCLUDED.price_label,
        source_price_man_won = EXCLUDED.source_price_man_won,
        source_price_label = EXCLUDED.source_price_label,
        fuel_type = EXCLUDED.fuel_type,
        transmission = EXCLUDED.transmission,
        location = EXCLUDED.location,
        dealer_name = EXCLUDED.dealer_name,
        image_url = EXCLUDED.image_url,
        source_url = EXCLUDED.source_url,
        source_modified_at = EXCLUDED.source_modified_at,
        synced_at = EXCLUDED.synced_at,
        last_seen_at = EXCLUDED.last_seen_at,
        is_active = TRUE
    `,
    [payload, seenAt],
  );
}

async function readFilters(): Promise<CatalogFilters> {
  const sql = getSql();
  const brandRows = (await sql.query(
    `
      SELECT DISTINCT brand
      FROM inventory_cars
      WHERE is_active = TRUE
      ORDER BY brand ASC
    `,
  )) as Array<{ brand: string }>;
  const fuelRows = (await sql.query(
    `
      SELECT DISTINCT fuel_type
      FROM inventory_cars
      WHERE is_active = TRUE
      ORDER BY fuel_type ASC
    `,
  )) as Array<{ fuel_type: string }>;

  return {
    brands: brandRows.map((row) => row.brand),
    fuels: fuelRows.map((row) => row.fuel_type),
  };
}

function buildWhereClause(query: CatalogQueryInput) {
  const conditions = ["is_active = TRUE"];
  const params: Array<string | number> = [];

  if (query.brand) {
    params.push(query.brand);
    conditions.push(`brand = $${params.length}`);
  }

  if (query.fuel) {
    params.push(query.fuel);
    conditions.push(`fuel_type = $${params.length}`);
  }

  if (query.yearFrom) {
    params.push(query.yearFrom);
    conditions.push(`year >= $${params.length}`);
  }

  if (query.maxPriceManWon) {
    params.push(query.maxPriceManWon);
    conditions.push(`source_price_man_won <= $${params.length}`);
  }

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getInventorySyncState() {
  return readSyncState();
}

export async function runBackfillBatch(batchSize?: number): Promise<SyncSummary> {
  const state = await readSyncState();
  const effectiveBatchSize = Math.max(1, batchSize ?? state.backfill_batch_size);
  const skip = Math.max(0, state.backfill_offset);

  if (state.backfill_complete && state.source_count > 0) {
    return {
      mode: "backfill",
      fetchedAt: new Date(state.fetched_at).toISOString(),
      sourceCount: state.source_count,
      syncedCount: state.synced_count,
      batchSize: effectiveBatchSize,
      batchCars: 0,
      backfillOffset: state.backfill_offset,
      backfillComplete: true,
    };
  }

  const batch = await fetchInventoryBatch(skip, effectiveBatchSize);
  const seenAt = new Date().toISOString();
  await upsertCars(batch.inventory.cars, seenAt);

  const syncedCount = await countActiveCars();
  const nextOffset = Math.min(batch.inventory.meta.sourceCount, batch.nextSkip);
  const backfillComplete =
    nextOffset >= batch.inventory.meta.sourceCount ||
    batch.inventory.cars.length === 0 ||
    batch.exhausted;

  await saveSyncState({
    ...state,
    source_count: batch.inventory.meta.sourceCount,
    synced_count: syncedCount,
    fetched_at: batch.inventory.meta.fetchedAt,
    query: batch.inventory.meta.query,
    backfill_offset: nextOffset,
    backfill_complete: backfillComplete,
    last_backfill_at: seenAt,
  });

    return {
      mode: "backfill",
      fetchedAt: batch.inventory.meta.fetchedAt,
      sourceCount: batch.inventory.meta.sourceCount,
      syncedCount,
      batchSize: effectiveBatchSize,
      batchCars: batch.inventory.cars.length,
      backfillOffset: nextOffset,
      backfillComplete,
    };
}

export async function runIncrementalRefresh(refreshLimit?: number): Promise<SyncSummary> {
  const state = await readSyncState();
  const effectiveRefreshLimit = Math.max(1, refreshLimit ?? state.recent_refresh_limit);
  const batch = await fetchInventoryBatch(0, effectiveRefreshLimit);
  const seenAt = new Date().toISOString();

  await upsertCars(batch.inventory.cars, seenAt);

  const syncedCount = await countActiveCars();
  const nextBackfillOffset =
    state.backfill_offset === 0
      ? Math.min(batch.nextSkip, batch.inventory.meta.sourceCount)
      : state.backfill_offset;

  await saveSyncState({
    ...state,
    source_count: batch.inventory.meta.sourceCount,
    synced_count: syncedCount,
    fetched_at: batch.inventory.meta.fetchedAt,
    query: batch.inventory.meta.query,
    backfill_offset: nextBackfillOffset,
    last_refresh_at: seenAt,
  });

  return {
    mode: "refresh",
    fetchedAt: batch.inventory.meta.fetchedAt,
    sourceCount: batch.inventory.meta.sourceCount,
    syncedCount,
    batchSize: effectiveRefreshLimit,
    batchCars: batch.inventory.cars.length,
    backfillOffset: nextBackfillOffset,
    backfillComplete: state.backfill_complete,
  };
}

export async function runScheduledInventorySync(): Promise<ScheduledSyncResult> {
  const actions: string[] = [];
  const state = await readSyncState();
  let refresh: SyncSummary | null = null;
  let backfill: SyncSummary | null = null;

  if (state.backfill_complete || state.backfill_offset >= state.recent_refresh_limit) {
    refresh = await runIncrementalRefresh(state.recent_refresh_limit);
    actions.push("refresh");
  }

  const refreshedState = await readSyncState();
  if (!refreshedState.backfill_complete) {
    backfill = await runBackfillBatch(refreshedState.backfill_batch_size);
    actions.push("backfill");
  } else if (!refresh) {
    refresh = await runIncrementalRefresh(refreshedState.recent_refresh_limit);
    actions.push("refresh");
  }

  const finalState = await readSyncState();
  const inventory = await getDatabaseInventory(finalState.recent_refresh_limit);

  return {
    actions,
    state: finalState,
    inventory,
    refresh,
    backfill,
  };
}

export async function getDatabaseInventory(limit = ENCAR_SYNC_LIMIT): Promise<InventoryPayload> {
  await ensureTables();

  const sql = getSql();
  const state = await readSyncState();
  const rows = (await sql.query(
    `
      SELECT
        id, title, brand, model, trim, year, mileage_km, price_krw, price_label,
        source_price_man_won, source_price_label, fuel_type, transmission, location,
        dealer_name, image_url, source_url, source_modified_at
      FROM inventory_cars
      WHERE is_active = TRUE
      ORDER BY source_modified_at DESC, id DESC
      LIMIT $1
    `,
    [limit],
  )) as InventoryRow[];

  if (rows.length === 0) {
    throw new Error("Database inventory is empty");
  }

  const cars = rows.map(rowToCar);

  return {
    cars,
    meta: {
      source: "database",
      sourceCount: state.source_count,
      syncedCount: state.synced_count,
      displayedCount: cars.length,
      fetchedAt: new Date(state.fetched_at).toISOString(),
      fetchedLabel: formatFetchedLabel(state.fetched_at),
      query: state.query || ENCAR_QUERY,
    },
  };
}

export async function getDatabaseCatalog(
  query: CatalogQueryInput,
  pageSize: number,
): Promise<DatabaseCatalogResult> {
  await ensureTables();

  const sql = getSql();
  const state = await readSyncState();
  const { whereSql, params } = buildWhereClause(query);

  const countRows = (await sql.query(
    `
      SELECT COUNT(*)::int AS total
      FROM inventory_cars
      ${whereSql}
    `,
    params,
  )) as Array<{ total: number }>;

  const totalFiltered = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalFiltered, 1) / pageSize));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * pageSize;

  const rows = (await sql.query(
    `
      SELECT
        id, title, brand, model, trim, year, mileage_km, price_krw, price_label,
        source_price_man_won, source_price_label, fuel_type, transmission, location,
        dealer_name, image_url, source_url, source_modified_at
      FROM inventory_cars
      ${whereSql}
      ORDER BY source_modified_at DESC, id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, pageSize, offset],
  )) as InventoryRow[];

  const filters = await readFilters();
  const cars = rows.map(rowToCar);

  return {
    cars,
    inventory: {
      cars,
      meta: {
        source: "database",
        sourceCount: state.source_count,
        syncedCount: state.synced_count,
        displayedCount: cars.length,
        fetchedAt: new Date(state.fetched_at).toISOString(),
        fetchedLabel: formatFetchedLabel(state.fetched_at),
        query: state.query || ENCAR_QUERY,
      },
    },
    filters,
    pagination: {
      page,
      pageSize,
      totalPages,
      totalFiltered,
    },
  };
}

import { neon } from "@neondatabase/serverless";
import {
  ENCAR_QUERY,
  ENCAR_SYNC_LIMIT,
  type InventoryCar,
  type InventoryPayload,
  fetchLiveInventory,
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
};

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
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS inventory_sync_state (
      key_name TEXT PRIMARY KEY,
      source_count INTEGER NOT NULL,
      synced_count INTEGER NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL,
      query TEXT NOT NULL
    )
  `);

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
}

async function readSyncState() {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT key_name, source_count, synced_count, fetched_at, query
      FROM inventory_sync_state
      WHERE key_name = 'primary'
      LIMIT 1
    `,
  )) as SyncStateRow[];

  return rows[0] ?? null;
}

async function readFilters(): Promise<CatalogFilters> {
  const sql = getSql();
  const brandRows = (await sql.query(
    `
      SELECT DISTINCT brand
      FROM inventory_cars
      ORDER BY brand ASC
    `,
  )) as Array<{ brand: string }>;
  const fuelRows = (await sql.query(
    `
      SELECT DISTINCT fuel_type
      FROM inventory_cars
      ORDER BY fuel_type ASC
    `,
  )) as Array<{ fuel_type: string }>;

  return {
    brands: brandRows.map((row) => row.brand),
    fuels: fuelRows.map((row) => row.fuel_type),
  };
}

function buildWhereClause(query: CatalogQueryInput) {
  const conditions: string[] = [];
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
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function syncInventoryToDatabase(limit = ENCAR_SYNC_LIMIT) {
  await ensureTables();

  const inventory = await fetchLiveInventory(limit);
  const sql = getSql();
  const syncStartedAt = new Date().toISOString();
  const payload = JSON.stringify(
    inventory.cars.map((car) => ({
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

  await sql.transaction([
    sql.query(
      `
        INSERT INTO inventory_cars (
          id, title, brand, model, trim, year, mileage_km, price_krw, price_label,
          source_price_man_won, source_price_label, fuel_type, transmission,
          location, dealer_name, image_url, source_url, source_modified_at, synced_at
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
          $2::timestamptz
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
          synced_at = EXCLUDED.synced_at
      `,
      [payload, syncStartedAt],
    ),
    sql.query(`DELETE FROM inventory_cars WHERE synced_at < $1::timestamptz`, [syncStartedAt]),
    sql.query(
      `
        INSERT INTO inventory_sync_state (
          key_name, source_count, synced_count, fetched_at, query
        )
        VALUES ('primary', $1, $2, $3, $4)
        ON CONFLICT (key_name) DO UPDATE SET
          source_count = EXCLUDED.source_count,
          synced_count = EXCLUDED.synced_count,
          fetched_at = EXCLUDED.fetched_at,
          query = EXCLUDED.query
      `,
      [
        inventory.meta.sourceCount,
        inventory.meta.syncedCount,
        inventory.meta.fetchedAt,
        inventory.meta.query,
      ],
    ),
  ]);

  return getDatabaseInventory(limit);
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
      ORDER BY source_modified_at DESC, id DESC
      LIMIT $1
    `,
    [limit],
  )) as InventoryRow[];

  if (!state || rows.length === 0) {
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

  if (!state) {
    throw new Error("Database sync state is missing");
  }

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

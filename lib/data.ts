import {
  ENCAR_SYNC_LIMIT,
  fetchLiveInventory,
  getSnapshotInventory,
  type InventoryPayload,
  type InventoryCar,
} from "@/lib/encar";
import {
  getDatabaseCatalog,
  getDatabaseInventory,
  isDatabaseConfigured,
} from "@/lib/postgres-inventory";

export type CatalogQuery = {
  page: number;
  brand: string;
  fuel: string;
  yearFrom: number;
  maxPriceManWon: number;
};

export type CatalogResult = {
  cars: InventoryCar[];
  inventory: InventoryPayload;
  filters: {
    brands: string[];
    fuels: string[];
  };
  query: CatalogQuery;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalFiltered: number;
  };
};

export const CATALOG_PAGE_SIZE = 18;

export async function getInventory(limit = ENCAR_SYNC_LIMIT): Promise<InventoryPayload> {
  if (isDatabaseConfigured()) {
    try {
      return await getDatabaseInventory(limit);
    } catch {}
  }

  try {
    return await fetchLiveInventory(limit);
  } catch {
    return getSnapshotInventory(limit);
  }
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseCatalogQuery(
  raw: Record<string, string | string[] | undefined>,
): CatalogQuery {
  const pageValue = Array.isArray(raw.page) ? raw.page[0] : raw.page;
  const brandValue = Array.isArray(raw.brand) ? raw.brand[0] : raw.brand;
  const fuelValue = Array.isArray(raw.fuel) ? raw.fuel[0] : raw.fuel;
  const yearFromValue = Array.isArray(raw.yearFrom) ? raw.yearFrom[0] : raw.yearFrom;
  const maxPriceValue = Array.isArray(raw.maxPrice) ? raw.maxPrice[0] : raw.maxPrice;

  return {
    page: Math.max(1, readNumber(pageValue, 1)),
    brand: brandValue ?? "",
    fuel: fuelValue ?? "",
    yearFrom: Math.max(0, readNumber(yearFromValue, 0)),
    maxPriceManWon: Math.max(0, readNumber(maxPriceValue, 0)),
  };
}

export async function getCatalog(query: CatalogQuery): Promise<CatalogResult> {
  if (isDatabaseConfigured()) {
    try {
      const databaseCatalog = await getDatabaseCatalog(query, CATALOG_PAGE_SIZE);

      return {
        cars: databaseCatalog.cars,
        inventory: databaseCatalog.inventory,
        filters: databaseCatalog.filters,
        query: {
          ...query,
          page: databaseCatalog.pagination.page,
        },
        pagination: databaseCatalog.pagination,
      };
    } catch {}
  }

  const inventory = await getInventory(ENCAR_SYNC_LIMIT);

  const collator = new Intl.Collator("ko");
  const brands = Array.from(new Set(inventory.cars.map((car) => car.brand))).sort(collator.compare);
  const fuels = Array.from(new Set(inventory.cars.map((car) => car.fuelType))).sort(collator.compare);

  const filtered = inventory.cars.filter((car) => {
    if (query.brand && car.brand !== query.brand) {
      return false;
    }
    if (query.fuel && car.fuelType !== query.fuel) {
      return false;
    }
    if (query.yearFrom && car.year < query.yearFrom) {
      return false;
    }
    if (query.maxPriceManWon && car.sourcePriceManWon > query.maxPriceManWon) {
      return false;
    }

    return true;
  });

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalFiltered, 1) / CATALOG_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  const cars = filtered.slice(start, start + CATALOG_PAGE_SIZE);

  return {
    cars,
    inventory,
    filters: {
      brands,
      fuels,
    },
    query: {
      ...query,
      page,
    },
    pagination: {
      page,
      pageSize: CATALOG_PAGE_SIZE,
      totalPages,
      totalFiltered,
    },
  };
}

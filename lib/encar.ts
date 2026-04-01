import snapshot from "@/data/cars.json";

export const ENCAR_QUERY = "(And.Hidden.N._.CarType.Y.)";
export const ENCAR_ENDPOINT = "https://api.encar.com/search/car/list/premium";
export const ENCAR_IMAGE_BASE = "https://ci.encar.com/carpicture";
export const ENCAR_DETAIL_BASE =
  "https://www.encar.com/dc/dc_cardetailview.do?carType=kor&carid=";
export const ENCAR_DAILY_REVALIDATE_SECONDS = 60 * 60 * 24;
export const ENCAR_CACHE_TAG = "inventory";
export const ENCAR_SYNC_LIMIT = 1200;
export const ENCAR_CHUNK_SIZE = 100;
const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 900'%3E%3Crect width='1200' height='900' fill='%23e8dece'/%3E%3Ccircle cx='962' cy='190' r='124' fill='%23bf9152' fill-opacity='.18'/%3E%3Cpath d='M160 664l166-198a36 36 0 0 1 56 0l114 136 172-208a36 36 0 0 1 56 0l316 370H160Z' fill='%23151515' fill-opacity='.16'/%3E%3Ctext x='160' y='208' fill='%23151515' fill-opacity='.75' font-family='Arial, sans-serif' font-size='76' font-weight='700'%3EMillion Miles%3C/text%3E%3Ctext x='160' y='286' fill='%236d655c' font-family='Arial, sans-serif' font-size='34'%3EImage temporarily unavailable%3C/text%3E%3C/svg%3E";

type RawPhoto = {
  location: string;
};

type RawCar = {
  Id: string;
  Manufacturer: string;
  Model: string;
  Badge?: string;
  BadgeDetail?: string;
  FormYear?: string;
  Mileage?: number;
  Price?: number;
  FuelType?: string;
  Transmission?: string;
  OfficeCityState?: string;
  DealerName?: string;
  ModifiedDate?: string;
  Photos?: RawPhoto[];
};

type RawResponse = {
  Count: number;
  SearchResults: RawCar[];
};

export type InventoryCar = {
  id: string;
  title: string;
  brand: string;
  model: string;
  trim: string;
  year: number;
  mileageKm: number;
  mileageLabel: string;
  priceKrw: number;
  priceLabel: string;
  sourcePriceManWon: number;
  sourcePriceLabel: string;
  fuelType: string;
  transmission: string;
  location: string;
  dealerName: string;
  imageUrl: string;
  sourceUrl: string;
  sourceModifiedAt: string;
};

export type InventoryPayload = {
  cars: InventoryCar[];
  meta: {
    source: "live" | "snapshot" | "database";
    sourceCount: number;
    syncedCount: number;
    displayedCount: number;
    fetchedAt: string;
    fetchedLabel: string;
    query: string;
  };
};

function formatKrw(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeTrim(raw: RawCar) {
  const trim = [raw.Badge, raw.BadgeDetail]
    .filter((part) => part && part !== "(세부등급 없음)")
    .join(" ")
    .trim();

  return trim || "Trim details not provided";
}

function buildImageUrl(raw: RawCar) {
  const photo = raw.Photos?.[0]?.location;
  if (!photo) {
    return FALLBACK_IMAGE;
  }

  return `${ENCAR_IMAGE_BASE}${photo}`;
}

function normalizeCar(raw: RawCar): InventoryCar {
  const year = Number.parseInt(raw.FormYear ?? "", 10) || 0;
  const mileageKm = Math.round(raw.Mileage ?? 0);
  const sourcePriceManWon = Math.round(raw.Price ?? 0);
  const priceKrw = sourcePriceManWon * 10_000;
  const title = [raw.Manufacturer, raw.Model].filter(Boolean).join(" ").trim();

  return {
    id: raw.Id,
    title,
    brand: raw.Manufacturer || "Unknown brand",
    model: raw.Model || "Unknown model",
    trim: normalizeTrim(raw),
    year,
    mileageKm,
    mileageLabel: `${formatNumber(mileageKm)} km`,
    priceKrw,
    priceLabel: formatKrw(priceKrw),
    sourcePriceManWon,
    sourcePriceLabel: `${formatNumber(sourcePriceManWon)} man-won`,
    fuelType: raw.FuelType || "Fuel not listed",
    transmission: raw.Transmission || "Transmission not listed",
    location: raw.OfficeCityState || "South Korea",
    dealerName: raw.DealerName || "ENCAR dealer",
    imageUrl: buildImageUrl(raw),
    sourceUrl: `${ENCAR_DETAIL_BASE}${raw.Id}`,
    sourceModifiedAt: raw.ModifiedDate || new Date().toISOString(),
  };
}

function normalizeResponse(raw: RawResponse, source: "live" | "snapshot"): InventoryPayload {
  const cars = raw.SearchResults.map(normalizeCar);
  const fetchedAt = new Date().toISOString();

  return {
    cars,
    meta: {
      source,
      sourceCount: raw.Count,
      syncedCount: cars.length,
      displayedCount: cars.length,
      fetchedAt,
      fetchedLabel: new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(fetchedAt)),
      query: ENCAR_QUERY,
    },
  };
}

function isInventoryPayload(value: unknown): value is InventoryPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as InventoryPayload;
  return Array.isArray(candidate.cars) && typeof candidate.meta?.sourceCount === "number";
}

export function getSnapshotInventory(limit?: number): InventoryPayload {
  const safeSnapshot = isInventoryPayload(snapshot)
    ? {
        ...snapshot,
        meta: {
          ...snapshot.meta,
          syncedCount: snapshot.meta.syncedCount ?? snapshot.cars.length,
        },
      }
    : {
        cars: [],
        meta: {
          source: "snapshot" as const,
          sourceCount: 0,
          syncedCount: 0,
          displayedCount: 0,
          fetchedAt: new Date().toISOString(),
          fetchedLabel: "Unavailable",
          query: ENCAR_QUERY,
        },
      };

  if (!limit) {
    return safeSnapshot;
  }

  return {
    ...safeSnapshot,
    cars: safeSnapshot.cars.slice(0, limit),
    meta: {
      ...safeSnapshot.meta,
      displayedCount: Math.min(limit, safeSnapshot.cars.length),
    },
  };
}

async function fetchEncarChunk(skip: number, limit: number): Promise<RawResponse> {
  const url = new URL(ENCAR_ENDPOINT);
  url.searchParams.set("count", "true");
  url.searchParams.set("q", ENCAR_QUERY);
  url.searchParams.set("sr", `|ModifiedDate|${skip}|${limit}`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    next: {
      revalidate: ENCAR_DAILY_REVALIDATE_SECONDS,
      tags: [ENCAR_CACHE_TAG],
    },
  });

  if (!response.ok) {
    throw new Error(`ENCAR upstream failed with ${response.status}`);
  }

  const raw = (await response.json()) as RawResponse;
  if (!Array.isArray(raw.SearchResults) || typeof raw.Count !== "number") {
    throw new Error("ENCAR response shape is invalid");
  }

  return raw;
}

export async function fetchLiveInventory(limit = ENCAR_SYNC_LIMIT): Promise<InventoryPayload> {
  const targetCount = Math.max(1, limit);
  const deduped = new Map<string, RawCar>();
  let sourceCount = 0;
  let skip = 0;
  let safetyCounter = 0;

  while (deduped.size < targetCount) {
    const currentLimit = ENCAR_CHUNK_SIZE;
    const raw = await fetchEncarChunk(skip, currentLimit);
    sourceCount = raw.Count;
    for (const car of raw.SearchResults) {
      deduped.set(car.Id, car);
    }
    skip += currentLimit;
    safetyCounter += 1;

    if (raw.SearchResults.length < currentLimit || skip >= sourceCount || safetyCounter > 50) {
      break;
    }
  }

  const cars = Array.from(deduped.values()).slice(0, targetCount);

  return normalizeResponse(
    {
      Count: sourceCount,
      SearchResults: cars,
    },
    "live",
  );
}

export function validateInventoryPayload(payload: InventoryPayload) {
  const issues: string[] = [];

  if (payload.cars.length === 0) {
    issues.push("Inventory is empty.");
  }

  const ids = new Set<string>();
  for (const car of payload.cars) {
    if (!car.id) {
      issues.push("A car is missing its id.");
    }
    if (ids.has(car.id)) {
      issues.push(`Duplicate car id detected: ${car.id}`);
    }
    ids.add(car.id);

    if (!car.imageUrl.startsWith("https://")) {
      issues.push(`Image URL is invalid for ${car.id}`);
    }

    if (!car.sourceUrl.includes("carid=")) {
      issues.push(`Source URL is invalid for ${car.id}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

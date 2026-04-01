import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENCAR_QUERY = "(And.Hidden.N._.CarType.Y.)";
const ENCAR_ENDPOINT = "https://api.encar.com/search/car/list/premium";
const ENCAR_IMAGE_BASE = "https://ci.encar.com/carpicture";
const ENCAR_DETAIL_BASE =
  "https://www.encar.com/dc/dc_cardetailview.do?carType=kor&carid=";
const LIMIT = Number.parseInt(process.env.ENCAR_SYNC_LIMIT ?? "180", 10);
const CHUNK_SIZE = 60;
const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 900'%3E%3Crect width='1200' height='900' fill='%23e8dece'/%3E%3Ccircle cx='962' cy='190' r='124' fill='%23bf9152' fill-opacity='.18'/%3E%3Cpath d='M160 664l166-198a36 36 0 0 1 56 0l114 136 172-208a36 36 0 0 1 56 0l316 370H160Z' fill='%23151515' fill-opacity='.16'/%3E%3Ctext x='160' y='208' fill='%23151515' fill-opacity='.75' font-family='Arial, sans-serif' font-size='76' font-weight='700'%3EMillion Miles%3C/text%3E%3Ctext x='160' y='286' fill='%236d655c' font-family='Arial, sans-serif' font-size='34'%3EImage temporarily unavailable%3C/text%3E%3C/svg%3E";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, "..", "data", "cars.json");

function formatKrw(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeTrim(raw) {
  return [raw.Badge, raw.BadgeDetail]
    .filter((part) => part && part !== "(세부등급 없음)")
    .join(" ")
    .trim();
}

function normalizeCar(raw) {
  const year = Number.parseInt(raw.FormYear ?? "", 10) || 0;
  const mileageKm = Math.round(raw.Mileage ?? 0);
  const sourcePriceManWon = Math.round(raw.Price ?? 0);
  const priceKrw = sourcePriceManWon * 10_000;

  return {
    id: raw.Id,
    title: [raw.Manufacturer, raw.Model].filter(Boolean).join(" ").trim(),
    brand: raw.Manufacturer || "Unknown brand",
    model: raw.Model || "Unknown model",
    trim: normalizeTrim(raw) || "Trim details not provided",
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
    imageUrl: raw.Photos?.[0]?.location
      ? `${ENCAR_IMAGE_BASE}${raw.Photos[0].location}`
      : FALLBACK_IMAGE,
    sourceUrl: `${ENCAR_DETAIL_BASE}${raw.Id}`,
    sourceModifiedAt: raw.ModifiedDate || new Date().toISOString(),
  };
}

async function main() {
  const aggregated = [];
  let sourceCount = 0;
  const chunks = Math.ceil(Math.max(1, LIMIT) / CHUNK_SIZE);

  for (let index = 0; index < chunks; index += 1) {
    const skip = index * CHUNK_SIZE;
    const currentLimit = Math.min(CHUNK_SIZE, LIMIT - aggregated.length);
    const url = new URL(ENCAR_ENDPOINT);
    url.searchParams.set("count", "true");
    url.searchParams.set("q", ENCAR_QUERY);
    url.searchParams.set("sr", `|ModifiedDate|${skip}|${currentLimit}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ENCAR upstream failed with ${response.status}`);
    }

    const rawChunk = await response.json();
    sourceCount = rawChunk.Count || sourceCount;
    aggregated.push(...(rawChunk.SearchResults || []));

    if (aggregated.length >= LIMIT || (rawChunk.SearchResults || []).length < currentLimit) {
      break;
    }
  }

  const cars = Array.from(new Map(aggregated.map((car) => [car.Id, car])).values())
    .slice(0, LIMIT)
    .map(normalizeCar);
  const fetchedAt = new Date().toISOString();

  const payload = {
    cars,
    meta: {
      source: "snapshot",
      sourceCount,
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

  await writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Saved ${cars.length} cars to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

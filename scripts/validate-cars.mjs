import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputPath = path.join(__dirname, "..", "data", "cars.json");

async function main() {
  const raw = JSON.parse(await readFile(inputPath, "utf8"));
  const issues = [];

  if (!Array.isArray(raw.cars)) {
    issues.push("cars must be an array");
  }

  if (!raw.meta || typeof raw.meta !== "object") {
    issues.push("meta block is missing");
  }

  const ids = new Set();
  for (const car of raw.cars || []) {
    if (!car.id) {
      issues.push("car without id");
    }
    if (ids.has(car.id)) {
      issues.push(`duplicate id: ${car.id}`);
    }
    ids.add(car.id);

    if (!car.brand || !car.model) {
      issues.push(`missing brand/model for ${car.id}`);
    }

    if (typeof car.priceKrw !== "number" || car.priceKrw <= 0) {
      issues.push(`invalid price for ${car.id}`);
    }

    if (typeof car.mileageKm !== "number" || car.mileageKm < 0) {
      issues.push(`invalid mileage for ${car.id}`);
    }

    if (typeof car.imageUrl !== "string" || !car.imageUrl.startsWith("https://")) {
      issues.push(`invalid imageUrl for ${car.id}`);
    }

    if (typeof car.sourceUrl !== "string" || !car.sourceUrl.includes("carid=")) {
      issues.push(`invalid sourceUrl for ${car.id}`);
    }
  }

  if ((raw.cars || []).length === 0) {
    issues.push("inventory is empty");
  }

  if (issues.length > 0) {
    console.error("Snapshot validation failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Snapshot is valid. Cars: ${raw.cars.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

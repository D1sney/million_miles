import { NextResponse } from "next/server";
import { getInventory } from "@/lib/data";

export async function GET() {
  const inventory = await getInventory(18);

  return NextResponse.json(inventory, {
    headers: {
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}

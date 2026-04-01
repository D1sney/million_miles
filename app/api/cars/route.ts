import { NextResponse } from "next/server";
import { getCatalog, parseCatalogQuery } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const catalog = await getCatalog(
    parseCatalogQuery({
      page: searchParams.get("page") ?? undefined,
      brand: searchParams.get("brand") ?? undefined,
      fuel: searchParams.get("fuel") ?? undefined,
      yearFrom: searchParams.get("yearFrom") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
    }),
  );

  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}

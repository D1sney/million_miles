import { revalidatePath, revalidateTag } from "next/cache";
import { ENCAR_CACHE_TAG, ENCAR_SYNC_LIMIT } from "@/lib/encar";
import { syncInventoryToDatabase } from "@/lib/postgres-inventory";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(ENCAR_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/api/cars");

  const inventory = await syncInventoryToDatabase(ENCAR_SYNC_LIMIT);

  return Response.json({
    ok: true,
    refreshedAt: new Date().toISOString(),
    source: inventory.meta.source,
    sourceCount: inventory.meta.sourceCount,
    syncedCount: inventory.meta.syncedCount,
    displayedCount: inventory.meta.displayedCount,
  });
}

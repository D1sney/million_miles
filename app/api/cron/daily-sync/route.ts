import { revalidatePath, revalidateTag } from "next/cache";
import { ENCAR_CACHE_TAG } from "@/lib/encar";
import {
  getInventorySyncState,
  runBackfillBatch,
  runIncrementalRefresh,
  runScheduledInventorySync,
} from "@/lib/postgres-inventory";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "scheduled";
  const requestedBatchSize = Number.parseInt(searchParams.get("batchSize") ?? "", 10);
  const batchSize = Number.isFinite(requestedBatchSize) ? requestedBatchSize : undefined;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(ENCAR_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/api/cars");

  if (mode === "status") {
    const state = await getInventorySyncState();

    return Response.json({
      ok: true,
      mode,
      state,
    });
  }

  if (mode === "refresh") {
    const refresh = await runIncrementalRefresh(batchSize);
    const state = await getInventorySyncState();

    return Response.json({
      ok: true,
      mode,
      refresh,
      state,
    });
  }

  if (mode === "backfill") {
    const backfill = await runBackfillBatch(batchSize);
    const state = await getInventorySyncState();

    return Response.json({
      ok: true,
      mode,
      backfill,
      state,
    });
  }

  const result = await runScheduledInventorySync();

  return Response.json({
    ok: true,
    mode: "scheduled",
    refreshedAt: new Date().toISOString(),
    actions: result.actions,
    source: result.inventory.meta.source,
    sourceCount: result.inventory.meta.sourceCount,
    syncedCount: result.inventory.meta.syncedCount,
    displayedCount: result.inventory.meta.displayedCount,
    state: result.state,
    refresh: result.refresh,
    backfill: result.backfill,
  });
}

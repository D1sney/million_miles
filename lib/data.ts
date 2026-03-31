import {
  fetchLiveInventory,
  getSnapshotInventory,
  type InventoryPayload,
} from "@/lib/encar";

export async function getInventory(limit = 18): Promise<InventoryPayload> {
  try {
    return await fetchLiveInventory(limit);
  } catch {
    return getSnapshotInventory(limit);
  }
}

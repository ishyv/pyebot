import { MongoStore } from "@/db/store";
import { RpgDiscoveredItemSchema, type RpgDiscoveredItem } from "@/db/schemas/rpg-discovery";
import { OkResult, ErrResult, type Result } from "@/core/result";

export const discoveryStore = new MongoStore("rpg_discovered_items", RpgDiscoveredItemSchema);

export async function getDiscoveredRecipe(hash: string): Promise<Result<RpgDiscoveredItem | null>> {
  return discoveryStore.get(hash);
}

export async function saveDiscoveredRecipe(item: RpgDiscoveredItem): Promise<Result<void>> {
  const setRes = await discoveryStore.set(item._id, item);
  if (setRes.isErr()) return ErrResult(setRes.error);
  return OkResult(undefined);
}

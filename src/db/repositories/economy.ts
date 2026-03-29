import { MongoStore } from "@/db/store";
import { MarketListingSchema, type MarketListingDoc } from "@/db/schemas/market";
import { ErrResult, OkResult, type Result } from "@/core/result";

export const marketStore = new MongoStore("marketListings", MarketListingSchema);

/** Returns all active listings for a guild, sorted by price ascending. */
export async function findActiveListings(
  guildId: string,
  options: { itemId?: string; sellerId?: string; limit?: number; skip?: number } = {},
): Promise<Result<MarketListingDoc[]>> {
  const filter: Record<string, unknown> = { guildId, status: "active" };
  if (options.itemId) filter.itemId = options.itemId;
  if (options.sellerId) filter.sellerId = options.sellerId;

  try {
    const col = await marketStore.collection();
    const cursor = col
      .find(filter as any)
      .sort({ pricePerUnit: 1, createdAt: 1 });
    if (options.skip) cursor.skip(options.skip);
    if (options.limit) cursor.limit(options.limit);
    const docs = await cursor.toArray();
    return OkResult(docs.map((d) => MarketListingSchema.parse(d)));
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Counts active listings for a specific seller in a guild. */
export async function countActiveListings(
  guildId: string,
  sellerId: string,
): Promise<Result<number>> {
  try {
    const col = await marketStore.collection();
    const count = await col.countDocuments({ guildId, sellerId, status: "active" } as any);
    return OkResult(count);
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

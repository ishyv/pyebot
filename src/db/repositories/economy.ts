import { MongoStore } from "@/db/store";
import { MarketListingSchema, type MarketListingDoc } from "@/db/schemas/market";
import {
  AchievementProgressSchema,
  UnlockedAchievementSchema,
  type AchievementProgressDoc,
  type UnlockedAchievementDoc,
} from "@/db/schemas/achievement";
import { QuestProgressSchema, type QuestProgressDoc } from "@/db/schemas/quest";
import { ErrResult, OkResult, type Result } from "@/core/result";

// ---------------------------------------------------------------------------
// Achievement stores
// ---------------------------------------------------------------------------

export const achievementProgressStore = new MongoStore(
  "achievementProgress",
  AchievementProgressSchema,
);

export const achievementUnlocksStore = new MongoStore(
  "achievementUnlocks",
  UnlockedAchievementSchema,
);

/** Returns all unlock records for a user. */
export async function getUnlocksForUser(userId: string): Promise<Result<UnlockedAchievementDoc[]>> {
  return achievementUnlocksStore.find({ userId } as any);
}

/** Returns all progress records for a user. */
export async function getProgressForUser(userId: string): Promise<Result<AchievementProgressDoc[]>> {
  return achievementProgressStore.find({ userId } as any);
}

// ---------------------------------------------------------------------------
// Quest store
// ---------------------------------------------------------------------------

export const questProgressStore = new MongoStore("questProgress", QuestProgressSchema);

/** Returns all active (not-yet-claimed) quests for a user. */
export async function getActiveQuestsForUser(userId: string): Promise<Result<QuestProgressDoc[]>> {
  return questProgressStore.find({ userId, rewardsClaimed: false } as any);
}

// ---------------------------------------------------------------------------
// Market store
// ---------------------------------------------------------------------------

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

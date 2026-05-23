import type { Filter } from "mongodb";
import { ErrResult, OkResult, type Result } from "@/core/result";
import {
  type AchievementProgressDoc,
  AchievementProgressSchema,
  type UnlockedAchievementDoc,
  UnlockedAchievementSchema,
} from "@/db/schemas/achievement";
import { type MarketListingDoc, MarketListingSchema } from "@/db/schemas/market";
import { type QuestProgressDoc, QuestProgressSchema } from "@/db/schemas/quest";
import { MongoStore } from "@/db/store";

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
  const filter: Filter<UnlockedAchievementDoc> = { userId };
  return achievementUnlocksStore.find(filter);
}

/** Returns all progress records for a user. */
export async function getProgressForUser(
  userId: string,
): Promise<Result<AchievementProgressDoc[]>> {
  const filter: Filter<AchievementProgressDoc> = { userId };
  return achievementProgressStore.find(filter);
}

// ---------------------------------------------------------------------------
// Quest store
// ---------------------------------------------------------------------------

export const questProgressStore = new MongoStore("questProgress", QuestProgressSchema);

/** Returns all active (not-yet-claimed) quests for a user. */
export async function getActiveQuestsForUser(userId: string): Promise<Result<QuestProgressDoc[]>> {
  const filter: Filter<QuestProgressDoc> = { userId, rewardsClaimed: false };
  return questProgressStore.find(filter);
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
  const filter: Filter<MarketListingDoc> = { guildId, status: "active" };
  if (options.itemId) filter.itemId = options.itemId;
  if (options.sellerId) filter.sellerId = options.sellerId;

  try {
    const col = await marketStore.collection();
    const cursor = col.find(filter).sort({ pricePerUnit: 1, createdAt: 1 });
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
    const filter: Filter<MarketListingDoc> = { guildId, sellerId, status: "active" };
    const count = await col.countDocuments(filter);
    return OkResult(count);
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

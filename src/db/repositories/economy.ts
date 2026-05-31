import type { Filter } from "mongodb";
import type { Result } from "@/core/result";
import {
  type AchievementProgressDoc,
  AchievementProgressSchema,
  type UnlockedAchievementDoc,
  UnlockedAchievementSchema,
} from "@/db/schemas/achievement";
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

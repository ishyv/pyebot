import type { Filter } from "mongodb";
import type { Result } from "@/core/result";
import {
  type AchievementProgressDoc,
  AchievementProgressSchema,
  type UnlockedAchievementDoc,
  UnlockedAchievementSchema,
} from "@/db/schemas/achievement";
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

/**
 * AchievementProgress and UnlockedAchievement — two components that
 * together model the achievement lifecycle.
 *
 * Why two components? Progress rows are touched often (incrementing
 * counters); unlocked rows are written-once and read-rarely. They have
 * different access patterns and would only artificially share a
 * collection.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const AchievementProgress = component({
  collection: "achievement_progress",
  schema: z.object({
    userId: z.string(),
    achievementId: z.string(),
    progress: z.number().int().nonnegative().default(0),
    target: z.number().int().min(1).default(1),
    completed: z.boolean().default(false),
    updatedAt: z.coerce.date().default(() => new Date()),
  }),
});
export type AchievementProgressValue = z.infer<typeof AchievementProgress.schema>;

export const UnlockedAchievement = component({
  collection: "unlocked_achievements",
  schema: z.object({
    userId: z.string(),
    achievementId: z.string(),
    unlockedAt: z.coerce.date().default(() => new Date()),
    rewardsClaimed: z.boolean().default(false),
    rewardsClaimedAt: z.coerce.date().optional(),
  }),
});
export type UnlockedAchievementValue = z.infer<typeof UnlockedAchievement.schema>;

export function achievementId(userId: string, achievementId: string): string {
  return `${userId}:${achievementId}`;
}

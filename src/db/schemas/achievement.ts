import { z } from "zod";

/**
 * Persisted record of a user's progress toward an achievement.
 * _id = userId:achievementId
 */
export const AchievementProgressSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  achievementId: z.string(),
  progress: z.number().int().nonnegative().catch(0),
  target: z.number().int().min(1).catch(1),
  completed: z.boolean().catch(false),
  updatedAt: z.coerce.date().catch(() => new Date()),
});

export type AchievementProgressDoc = z.infer<typeof AchievementProgressSchema>;

/**
 * Persisted record of a user's unlocked achievement.
 * _id = userId:achievementId
 */
export const UnlockedAchievementSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  achievementId: z.string(),
  unlockedAt: z.coerce.date().catch(() => new Date()),
  rewardsClaimed: z.boolean().catch(false),
  rewardsClaimedAt: z.coerce.date().optional(),
});

export type UnlockedAchievementDoc = z.infer<typeof UnlockedAchievementSchema>;

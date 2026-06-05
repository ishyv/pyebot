/**
 * Achievements — a user's achievement progress and unlocks.
 *
 * Two maps keyed by achievement id (the keys replace the old
 * `userId:achievementId` document ids): `progress` tracks the running counter
 * toward each achievement's target, `unlocked` records the ones that have fired
 * and whether their rewards were claimed. They were two collections before
 * because progress is written often and unlocks once; on the entity model both
 * live on the same user document and are read together by the board, so one
 * component with two fields is the natural shape.
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { defineComponent } from "@/framework";

export const AchievementProgressEntry = z.object({
  progress: z.number().int().nonnegative().default(0),
  target: z.number().int().min(1).default(1),
  completed: z.boolean().default(false),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type AchievementProgressEntryValue = z.infer<typeof AchievementProgressEntry>;

export const AchievementUnlockEntry = z.object({
  unlockedAt: z.coerce.date().default(() => new Date()),
  rewardsClaimed: z.boolean().default(false),
  rewardsClaimedAt: z.coerce.date().optional(),
});
export type AchievementUnlockEntryValue = z.infer<typeof AchievementUnlockEntry>;

export const Achievements = defineComponent(
  User,
  "achievements",
  z.object({
    /** achievementId → progress toward its target. */
    progress: z.record(z.string(), AchievementProgressEntry).default(() => ({})),
    /** achievementId → unlock record (present once fired). */
    unlocked: z.record(z.string(), AchievementUnlockEntry).default(() => ({})),
  }),
);

export type AchievementsValue = z.infer<typeof Achievements.schema>;

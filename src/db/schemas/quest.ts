import { z } from "zod";

/**
 * Persisted record of a user's active or completed quest.
 * _id = userId:questId
 */
export const QuestProgressSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  questId: z.string(),
  /** Per-step progress counts, parallel to QuestDef.steps */
  stepProgress: z.array(z.number().int().nonnegative()).catch(() => []),
  completed: z.boolean().catch(false),
  rewardsClaimed: z.boolean().catch(false),
  startedAt: z.coerce.date().catch(() => new Date()),
  completedAt: z.coerce.date().optional(),
  rewardsClaimedAt: z.coerce.date().optional(),
});

export type QuestProgressDoc = z.infer<typeof QuestProgressSchema>;

/**
 * QuestProgress — a user's progress through a specific quest definition.
 *
 * Keyed by `${userId}:${questId}`. Per-step progress is an array parallel
 * to the QuestDef.steps. Completed/rewards-claimed booleans drive the
 * lifecycle (active → completed → rewards-claimed).
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const QuestProgress = component({
  collection: "quest_progress",
  schema: z.object({
    userId: z.string(),
    questId: z.string(),
    stepProgress: z.array(z.number().int().nonnegative()).default(() => []),
    completed: z.boolean().default(false),
    rewardsClaimed: z.boolean().default(false),
    startedAt: z.coerce.date().default(() => new Date()),
    completedAt: z.coerce.date().optional(),
    rewardsClaimedAt: z.coerce.date().optional(),
  }),
});

export type QuestProgressValue = z.infer<typeof QuestProgress.schema>;

export function questProgressId(userId: string, questId: string): string {
  return `${userId}:${questId}`;
}

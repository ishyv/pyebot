/**
 * QuestLog — a user's quest progress, one entry per accepted quest.
 *
 * Keyed by quest id (the map key replaces the old `userId:questId` document
 * id). The owning user is the entity, so `userId` and a separate `_id` are no
 * longer stored — they were redundant with the entity coordinates. Everything a
 * user has touched lives in one map on the user document, so listing a user's
 * active quests is an in-memory filter rather than a cross-collection query.
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { defineComponent } from "@/framework";

export const QuestEntry = z.object({
  /** Per-step progress counts, parallel to QuestDef.steps. */
  stepProgress: z.array(z.number().int().nonnegative()).default(() => []),
  completed: z.boolean().default(false),
  rewardsClaimed: z.boolean().default(false),
  startedAt: z.coerce.date().default(() => new Date()),
  completedAt: z.coerce.date().optional(),
  rewardsClaimedAt: z.coerce.date().optional(),
});
export type QuestEntryValue = z.infer<typeof QuestEntry>;

export const QuestLog = defineComponent(
  User,
  "questLog",
  z.object({
    /** questId → progress for that quest. */
    entries: z.record(z.string(), QuestEntry).default(() => ({})),
  }),
);

export type QuestLogValue = z.infer<typeof QuestLog.schema>;

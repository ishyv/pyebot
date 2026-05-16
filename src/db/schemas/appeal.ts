/**
 * Appeal schema.
 *
 * An appeal is created when a banned user submits a modal from their DM.
 * One appeal per case (keyed `appeal:{guildId}:{caseId}`). Denied appeals
 * are permanent — the user cannot re-appeal the same case.
 *
 * Validated at the repository boundary; plain `Appeal` type used inside.
 */
import { z } from "zod";

export const AppealDecisionSchema = z.object({
  reviewerId: z.string(),
  decidedAt: z.string(),
  reasonCode: z.enum(["wrongful_punishment", "served_time", "mistaken_identity", "other"]),
  note: z.string().optional(),
});

export const AppealSchema = z.object({
  /** Composite key: `appeal:{guildId}:{caseId}`. */
  _id: z.string(),
  guildId: z.string(),
  /** The moderation case ID this appeal is for. */
  caseId: z.number(),
  userId: z.string(),
  /** Snapshot at submit time — user may leave the guild before decision. */
  userTag: z.string(),
  submittedAt: z.string(),
  reason: z.string().max(2000),
  /** Private thread ID for moderator discussion — archived on resolution. */
  threadId: z.string(),
  status: z.enum(["pending", "approved", "denied", "info_requested"]),
  decision: AppealDecisionSchema.optional(),
});

export type Appeal = z.infer<typeof AppealSchema>;
export type AppealDecision = z.infer<typeof AppealDecisionSchema>;
export type AppealStatus = Appeal["status"];
export type AppealDecisionReasonCode = AppealDecision["reasonCode"];

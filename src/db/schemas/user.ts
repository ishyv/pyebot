import { z } from "zod";
import { SanctionTypeSchema } from "@/features/moderation/sanctions";
import { CurrencyInventorySchema } from "./currency";
import { type EconomyAccountData, EconomyAccountSchema } from "./economy-account";
import { type RpgProfileData, RpgProfileSchema } from "./rpg-profile";

export const WarnSchema = z.object({
  reason: z.string().catch(""),
  warn_id: z.string(),
  moderator: z.string(),
  timestamp: z.string(),
});
export type Warn = z.infer<typeof WarnSchema>;

export const SanctionType = SanctionTypeSchema;
export type SanctionType = z.infer<typeof SanctionType>;

export const SanctionHistoryEntrySchema = z.object({
  type: SanctionType,
  description: z.string(),
  date: z
    .string()
    .optional()
    .catch(() => new Date().toISOString()),
  caseId: z
    .number()
    .int()
    .optional()
    .catch(() => undefined),
  moderatorId: z
    .string()
    .optional()
    .catch(() => undefined),
  moderatorRoleIds: z
    .array(z.string())
    .optional()
    .catch(() => undefined),
  source: z
    .enum(["manual", "automod", "appeal", "escalation", "system"])
    .optional()
    .catch(() => undefined),
  evidenceSummary: z
    .string()
    .optional()
    .catch(() => undefined),
});
export type SanctionHistoryEntry = z.infer<typeof SanctionHistoryEntrySchema>;

export const ModNoteSchema = z.object({
  note: z.string(),
  moderatorId: z.string(),
  createdAt: z.string(),
});
export type ModNote = z.infer<typeof ModNoteSchema>;

/**
 * Legacy RPG inventory stored directly on the user document.
 * Keys are runtime item IDs; values are nonnegative stack counts.
 */
export const UserInventorySchema = z.record(z.string(), z.number().int().nonnegative()).default({});
export type UserInventory = z.infer<typeof UserInventorySchema>;

export const UserSchema = z.object({
  _id: z.string(),
  warns: z.array(WarnSchema).catch(() => []),
  sanction_history: z.record(z.string(), z.array(SanctionHistoryEntrySchema)).catch(() => ({})),
  openTickets: z.array(z.string()).catch(() => []),
  // Legacy user-doc currency bag still used by RPG processing/hideout paths.
  // Current economy spendable balances live in UserCurrency.balances.
  currency: CurrencyInventorySchema.catch(() => ({})),
  inventory: UserInventorySchema,
  // Legacy user-doc bank bag. Current economy bank balances live in UserCurrency.bankBalances.
  bank: z
    .record(z.string(), z.number())
    .optional()
    .catch(() => ({})),
  mod_notes: z
    .record(
      z.string(),
      z.array(ModNoteSchema).catch(() => []),
    )
    .catch(() => ({})),
  quarantine_roles: z
    .record(
      z.string(),
      z.array(z.string()).catch(() => []),
    )
    .catch(() => ({})),
  // Legacy embedded economy metadata. Current economy status/streak data lives in the EconomyAccount component.
  economyAccount: EconomyAccountSchema.optional().catch(() => undefined) as z.ZodType<
    EconomyAccountData | undefined
  >,
  // RPG profile — embedded subdocument
  rpgProfile: RpgProfileSchema.optional().catch(() => undefined) as z.ZodType<
    RpgProfileData | undefined
  >,
  minigames: z
    .record(z.string(), z.unknown())
    .optional()
    .catch(() => ({})),
  votingStats: z
    .record(z.string(), z.unknown())
    .optional()
    .catch(() => ({})),
  voteAggregates: z
    .record(z.string(), z.unknown())
    .optional()
    .catch(() => ({})),
  votingPrefs: z
    .object({
      optOut: z.boolean().optional(),
      showVotes: z.boolean().optional(),
      updatedAt: z.date().optional(),
    })
    .optional()
    .catch(() => ({})),
  createdAt: z.coerce
    .date()
    .optional()
    .catch(() => undefined),
  updatedAt: z.coerce
    .date()
    .optional()
    .catch(() => undefined),
});
export type User = z.infer<typeof UserSchema>;

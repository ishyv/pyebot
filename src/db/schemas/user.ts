import { z } from "zod";
import { RpgProfileSchema, type RpgProfileData } from "./rpg-profile";
import { EconomyAccountSchema, type EconomyAccountData } from "./economy-account";
import { CurrencyInventorySchema } from "./currency";

export const WarnSchema = z.object({
  reason: z.string().catch(""),
  warn_id: z.string(),
  moderator: z.string(),
  timestamp: z.string(),
});
export type Warn = z.infer<typeof WarnSchema>;

export const SanctionType = z.enum(["BAN", "KICK", "TIMEOUT", "WARN", "RESTRICT"]);
export type SanctionType = z.infer<typeof SanctionType>;

export const SanctionHistoryEntrySchema = z.object({
  type: SanctionType,
  description: z.string(),
  date: z.string().optional().catch(() => new Date().toISOString()),
});
export type SanctionHistoryEntry = z.infer<typeof SanctionHistoryEntrySchema>;

export const UserSchema = z.object({
  _id: z.string(),
  warns: z.array(WarnSchema).catch(() => []),
  sanction_history: z.record(z.string(), z.array(SanctionHistoryEntrySchema)).catch(() => ({})),
  openTickets: z.array(z.string()).catch(() => []),
  currency: CurrencyInventorySchema.catch(() => ({})),
  inventory: z.record(z.string(), z.unknown()).catch(() => ({})),
  bank: z.record(z.string(), z.number()).optional().catch(() => ({})),
  // Economy account data
  economyAccount: EconomyAccountSchema.optional().catch(() => undefined) as z.ZodType<EconomyAccountData | undefined>,
  // RPG profile — embedded subdocument
  rpgProfile: RpgProfileSchema.optional().catch(() => undefined) as z.ZodType<RpgProfileData | undefined>,
  minigames: z.record(z.string(), z.unknown()).optional().catch(() => ({})),
  votingStats: z.record(z.string(), z.unknown()).optional().catch(() => ({})),
  voteAggregates: z.record(z.string(), z.unknown()).optional().catch(() => ({})),
  votingPrefs: z.object({
    optOut: z.boolean().optional(),
    showVotes: z.boolean().optional(),
    updatedAt: z.date().optional(),
  }).optional().catch(() => ({})),
  createdAt: z.coerce.date().optional().catch(() => undefined),
  updatedAt: z.coerce.date().optional().catch(() => undefined),
});
export type User = z.infer<typeof UserSchema>;

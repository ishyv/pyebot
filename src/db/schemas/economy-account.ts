/**
 * Legacy embedded EconomyAccount subdocument on UserSchema.
 *
 * Purpose: Runtime validation and default values for old user-doc account metadata.
 * Encaje: Imported by UserSchema so persisted legacy user documents keep parsing.
 * Current economy account state lives in src/components/economy-account.ts.
 * Dependencies: Zod for validation.
 * Invariants:
 * - All dates default to new Date() if missing/invalid.
 * - Status defaults to 'ok'.
 * - Version defaults to 0 and increments on each update.
 */

import { z } from "zod";

export type AccountStatus = "ok" | "blocked" | "banned";

export const AccountStatusSchema: z.ZodType<AccountStatus> = z
  .enum(["ok", "blocked", "banned"])
  .catch("ok");

// Coerce dates from strings/numbers; default to now if invalid
const DateSchema = z.coerce.date().catch(() => new Date());

export const EconomyAccountSchema = z.object({
  status: AccountStatusSchema,
  createdAt: DateSchema,
  updatedAt: DateSchema,
  lastActivityAt: DateSchema,
  version: z.number().int().nonnegative().catch(0),
  dailyStreak: z.number().int().min(0).catch(0),
  lastDailyAt: z.coerce.date().nullable().catch(null),
});

/** Type for legacy embedded economy account data as stored in user documents. */
export type EconomyAccountData = z.infer<typeof EconomyAccountSchema>;

/** Partial type for updates. */
export type EconomyAccountPatch = Partial<EconomyAccountData>;

/**
 * Safely parse legacy embedded economy account data with full defaults.
 * Returns null if input is null/undefined.
 * All fields have .catch() so EconomyAccountSchema.parse() never throws.
 */
export function parseEconomyAccount(data: unknown): EconomyAccountData | null {
  if (!data) return null;
  return EconomyAccountSchema.parse(data);
}

/**
 * Zod schema for EconomyAccount subdocument.
 *
 * Purpose: Runtime validation and default values for economy account metadata.
 * Encaje: Imported by UserSchema and the economy account feature module.
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
});

/** Type for economy account data as stored in DB. */
export type EconomyAccountData = z.infer<typeof EconomyAccountSchema>;

/** Partial type for updates. */
export type EconomyAccountPatch = Partial<EconomyAccountData>;

/**
 * Safely parse economy account data with full defaults.
 * Returns null if input is null/undefined.
 */
export function parseEconomyAccount(data: unknown): EconomyAccountData | null {
  if (!data) return null;
  const parsed = EconomyAccountSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  // If parsing fails entirely, return default structure
  return EconomyAccountSchema.parse({});
}

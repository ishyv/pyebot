/**
 * UserCurrency — a user's wallet across every currency the bot supports.
 *
 * Modeled as a flat record keyed by currency id (`coins`, `rep`, etc.).
 * Missing currency = balance 0; negative balances are permitted for
 * moderator-driven adjustments (debt scenarios).
 *
 * Why a separate component instead of the old `user.currency` field?
 * Currency is read on every economy interaction. Keeping it isolated
 * from the rest of the user document makes each read cheap and lets us
 * index by balance later if we add leaderboards.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const UserCurrency = component({
  collection: "user_currencies",
  schema: z.object({
    balances: z.record(z.string(), z.number().int().catch(0)).default({}),
    bankBalances: z.record(z.string(), z.number().int().catch(0)).default({}),
  }),
});

export type UserCurrencyValue = z.infer<typeof UserCurrency.schema>;

/** Well-known currency IDs the bot tracks. Extend as needed. */
export const CURRENCY_IDS = ["coins", "rep"] as const;
export type KnownCurrencyId = (typeof CURRENCY_IDS)[number];

export function isValidCurrencyId(id: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(id);
}

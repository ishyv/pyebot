import { z } from "zod";

/**
 * Legacy user-document currency balance for standard currencies.
 * Component economy balances use src/components/user-currency.ts instead.
 */
export const CurrencyBalanceSchema = z.number().int().min(0).catch(0);
export type CurrencyBalance = z.infer<typeof CurrencyBalanceSchema>;

/**
 * Legacy user-document currency bag, not the current economy wallet.
 * The current economy wallet is UserCurrency.balances; this remains for user-doc/RPG paths.
 * Keys are currency IDs (e.g. "coins", "rep").
 * Values are balances; negative values are allowed (debt, mod-applied deductions).
 */
export const CurrencyInventorySchema = z.record(z.string(), z.number().int().catch(0));
export type CurrencyInventory = z.infer<typeof CurrencyInventorySchema>;

/** Well-known currency IDs. */
export const CURRENCY_IDS = ["coins", "rep"] as const;
export type KnownCurrencyId = (typeof CURRENCY_IDS)[number];

/** Validate a currency ID string. Returns true if it's a non-empty lowercase string. */
export function isValidCurrencyId(id: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(id);
}

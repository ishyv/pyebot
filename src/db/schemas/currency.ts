import { z } from "zod";

/**
 * Currency balance for standard currencies (stored as plain number).
 * Represents the total amount (e.g. 100 coins, 50 rep).
 */
export const CurrencyBalanceSchema = z.number().int().min(0).catch(0);
export type CurrencyBalance = z.infer<typeof CurrencyBalanceSchema>;

/**
 * Currency inventory — the full wallet on a user document.
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

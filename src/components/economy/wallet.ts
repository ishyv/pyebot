/**
 * Economy wallet and account state, stored on the owning User entity.
 *
 * Wallet balances and account metadata are user-owned runtime state. Keeping
 * them as separate fields on the same user document preserves their domain
 * boundary while retiring the old one-collection-per-component storage.
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { defineComponent } from "@/framework";

export const UserCurrency = defineComponent(
  User,
  "currency",
  z.object({
    balances: z.record(z.string(), z.number().int().catch(0)).default({}),
    bankBalances: z.record(z.string(), z.number().int().catch(0)).default({}),
  }),
);

export type UserCurrencyValue = z.infer<typeof UserCurrency.schema>;

export const EconomyAccount = defineComponent(
  User,
  "economyAccount",
  z.object({
    status: z.enum(["ok", "blocked", "banned"]).default("ok"),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
    lastActivityAt: z.coerce.date().default(() => new Date()),
    /** Optimistic-concurrency version; bumped on every adjustment. */
    version: z.number().int().nonnegative().default(0),
    dailyStreak: z.number().int().min(0).default(0),
    lastDailyAt: z.coerce.date().nullable().default(null),
  }),
);

export type EconomyAccountValue = z.infer<typeof EconomyAccount.schema>;

/** Well-known currency IDs the bot tracks. Extend as needed. */
export const CURRENCY_IDS = ["coins", "rep", "scrip"] as const;
export type KnownCurrencyId = (typeof CURRENCY_IDS)[number];

/** Narrows command-provided currency ids to the bot's simple storage-safe shape. */
export function isValidCurrencyId(id: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(id);
}

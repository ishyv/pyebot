/**
 * EconomyAccount — per-user metadata for participation in the economy.
 *
 * Distinct from UserCurrency: the wallet is *what you own*; the account
 * is *whether you can participate*. We separate them because the wallet
 * is touched on every transaction, while the account is checked once at
 * the start of an economy command (and only mutated when an admin
 * suspends a user). Different read frequencies = different documents.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const EconomyAccount = component({
  collection: "economy_accounts",
  schema: z.object({
    status: z.enum(["ok", "blocked", "banned"]).default("ok"),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
    lastActivityAt: z.coerce.date().default(() => new Date()),
    /** Optimistic-concurrency version; bumped on every adjustment. */
    version: z.number().int().nonnegative().default(0),
    dailyStreak: z.number().int().min(0).default(0),
    lastDailyAt: z.coerce.date().nullable().default(null),
  }),
});

export type EconomyAccountValue = z.infer<typeof EconomyAccount.schema>;

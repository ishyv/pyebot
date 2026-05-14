/**
 * Economy account lifecycle module.
 *
 * Manages economy account metadata via the `EconomyAccount` component.
 * `ensureAccount` is now a thin wrapper around `ctx.ensure` — the World handles
 * upsert with defaults, eliminating the need for manual atomicTransition logic.
 */

import type { Ctx } from "@/framework/types";
import { EconomyAccount } from "@/components/economy-account";

export type { EconomyAccountValue } from "@/components/economy-account";
export type AccountStatus = "ok" | "blocked" | "banned";

/** Get-or-create the user's economy account. Returns the account value. */
export async function ensureAccount(ctx: Ctx, userId: string) {
  return ctx.ensure(userId, EconomyAccount);
}

/** True if the account status permits economy usage. */
export function isAccountActive(status: AccountStatus | string): boolean {
  return status === "ok";
}

/** Touch lastActivityAt. Fire-and-forget — never throws. */
export function touchActivity(ctx: Ctx, userId: string): void {
  ctx.patch(userId, EconomyAccount, { lastActivityAt: new Date() }).catch(() => {});
}

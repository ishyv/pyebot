/**
 * Economy account lifecycle module.
 *
 * Manages economy account metadata via the User entity's `EconomyAccount`
 * component. The wrapper keeps account participation semantics out of callers
 * that should not care where the state is stored.
 */

import { EconomyAccount } from "@/components/economy/wallet";
import { User } from "@/components/entities";
import type { Ctx } from "@/framework/types";

export type { EconomyAccountValue } from "@/components/economy/wallet";
export type AccountStatus = "ok" | "blocked" | "banned";

/** Get-or-create the user's economy account. Returns the account value. */
export async function ensureAccount(ctx: Ctx, userId: string) {
  return ctx.of(User, userId).get(EconomyAccount);
}

/** True if the account status permits economy usage. */
export function isAccountActive(status: AccountStatus | string): boolean {
  return status === "ok";
}

/** Touch lastActivityAt. Fire-and-forget — never throws. */
export function touchActivity(ctx: Ctx, userId: string): void {
  ctx
    .of(User, userId)
    .update(EconomyAccount, { lastActivityAt: new Date() })
    .catch(() => {});
}

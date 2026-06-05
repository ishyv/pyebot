/**
 * Storage boundary for automod temporary-role grants.
 *
 * One entity per grant. The expiry sweep selects the soonest-expiring batch by
 * sorting on `expiresAt` rather than scanning every grant, so the periodic pass
 * stays bounded.
 */

import { TempRoleGrant } from "@/components/entities";
import { TempRoleGrantRecord, type TempRoleGrantValue } from "@/components/temp-role-grant";
import type { Ctx } from "@/framework/types";

/** How many soonest-expiring grants one sweep pass inspects. */
const SWEEP_BATCH = 200;

export async function setTempRoleGrant(
  ctx: Ctx,
  grantId: string,
  grant: TempRoleGrantValue,
): Promise<void> {
  await ctx.of(TempRoleGrant, grantId).set(TempRoleGrantRecord, grant);
}

export async function getTempRoleGrant(
  ctx: Ctx,
  grantId: string,
): Promise<TempRoleGrantValue | null> {
  return ctx.of(TempRoleGrant, grantId).peek(TempRoleGrantRecord);
}

export async function deleteTempRoleGrant(ctx: Ctx, grantId: string): Promise<void> {
  await ctx.of(TempRoleGrant, grantId).remove(TempRoleGrantRecord);
}

/** Grants due at or before `now`, soonest first, capped to one sweep batch. */
export async function dueTempRoleGrants(
  ctx: Ctx,
  now: Date,
): Promise<Array<{ id: string; value: TempRoleGrantValue }>> {
  const rows = await ctx
    .select(TempRoleGrantRecord)
    .sortAsc((g) => g.expiresAt)
    .limit(SWEEP_BATCH)
    .run();
  return rows.filter((row) => row.value.expiresAt <= now);
}

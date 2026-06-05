/**
 * Storage boundary for autorole rules and timed grants.
 *
 * Rules live in a per-guild `AutoroleRules` map (per-guild reads are
 * single-document). Timed grants are one entity each; the expiry sweep selects
 * the earliest-expiring batch by sorting on `expiresAt` rather than scanning
 * every grant, so the periodic pass stays bounded.
 */

import {
  AutoroleRules,
  type AutoroleRuleValue,
  TimedAutoroleGrant,
  type TimedAutoroleGrantValue,
} from "@/components/autorole-rule";
import { Guild, TimedAutoroleGrant as TimedAutoroleGrantKind } from "@/components/entities";
import type { Ctx } from "@/framework/types";

/** How many soonest-expiring grants one sweep pass inspects. */
const SWEEP_BATCH = 200;

export async function listAutoroleRules(ctx: Ctx, guildId: string): Promise<AutoroleRuleValue[]> {
  return Object.values((await ctx.of(Guild, guildId).get(AutoroleRules)).rules);
}

export async function getAutoroleRule(
  ctx: Ctx,
  guildId: string,
  name: string,
): Promise<AutoroleRuleValue | null> {
  return (await ctx.of(Guild, guildId).get(AutoroleRules)).rules[name] ?? null;
}

/** Create or replace a rule. */
export async function putAutoroleRule(ctx: Ctx, rule: AutoroleRuleValue): Promise<void> {
  await ctx
    .of(Guild, rule.guildId)
    .update(AutoroleRules, (s) => ({ rules: { ...s.rules, [rule.name]: rule } }));
}

export async function deleteAutoroleRule(ctx: Ctx, guildId: string, name: string): Promise<void> {
  await ctx.of(Guild, guildId).update(AutoroleRules, (s) => {
    const rules = { ...s.rules };
    delete rules[name];
    return { rules };
  });
}

export async function setTimedGrant(
  ctx: Ctx,
  grantId: string,
  grant: TimedAutoroleGrantValue,
): Promise<void> {
  await ctx.of(TimedAutoroleGrantKind, grantId).set(TimedAutoroleGrant, grant);
}

export async function deleteTimedGrant(ctx: Ctx, grantId: string): Promise<void> {
  await ctx.of(TimedAutoroleGrantKind, grantId).remove(TimedAutoroleGrant);
}

/** Grants due at or before `now`, soonest first, capped to one sweep batch. */
export async function dueTimedGrants(
  ctx: Ctx,
  now: Date,
): Promise<Array<{ id: string; value: TimedAutoroleGrantValue }>> {
  const rows = await ctx
    .select(TimedAutoroleGrant)
    .sortAsc((g) => g.expiresAt)
    .limit(SWEEP_BATCH)
    .run();
  return rows.filter((row) => row.value.expiresAt <= now);
}

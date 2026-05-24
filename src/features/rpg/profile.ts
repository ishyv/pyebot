/**
 * Component-backed RPG profile helpers.
 *
 * RPG profile state is active feature state, so new command/domain paths use
 * `Ctx` + `RpgProfile` instead of the legacy embedded `users.rpgProfile`
 * repository. Inventory and currency live in their own user components.
 */

import { RpgProfile, type RpgProfileValue } from "@/components/rpg-profile";
import type { Ctx } from "@/framework/types";

export type RpgProfilePatch = Partial<RpgProfileValue>;

/** Reads the canonical RPG profile component for a user. */
export function getRpgProfile(ctx: Ctx, userId: string): Promise<RpgProfileValue | null> {
  return ctx.get(userId, RpgProfile);
}

/** Reads or creates the canonical RPG profile component for a user. */
export function ensureRpgProfile(ctx: Ctx, userId: string): Promise<RpgProfileValue> {
  return ctx.ensure(userId, RpgProfile);
}

/** Applies a partial update to the canonical RPG profile and returns the fresh value. */
export async function patchRpgProfile(
  ctx: Ctx,
  userId: string,
  patch: RpgProfilePatch,
): Promise<RpgProfileValue> {
  await ctx.patch(userId, RpgProfile, { ...patch, updatedAt: new Date() });
  return ctx.ensure(userId, RpgProfile);
}

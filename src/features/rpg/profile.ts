/**
 * Entity-backed RPG profile helpers.
 *
 * RPG profile state is active user-owned feature state. Keep the storage
 * surface here so command/domain paths preserve the "missing profile means not
 * onboarded" boundary without re-learning entity API details everywhere.
 */

import { User } from "@/components/entities";
import { RpgProfile, type RpgProfileValue } from "@/components/rpg/profile";
import type { Ctx } from "@/framework/types";

export type RpgProfilePatch = Partial<RpgProfileValue>;

/** Reads the canonical RPG profile component for a user. */
export function getRpgProfile(ctx: Ctx, userId: string): Promise<RpgProfileValue | null> {
  return ctx.of(User, userId).peek(RpgProfile);
}

/** Reads or creates the canonical RPG profile component for a user. */
export function ensureRpgProfile(ctx: Ctx, userId: string): Promise<RpgProfileValue> {
  return ctx.of(User, userId).get(RpgProfile);
}

/** Applies a partial update to the canonical RPG profile and returns the fresh value. */
export async function patchRpgProfile(
  ctx: Ctx,
  userId: string,
  patch: RpgProfilePatch,
): Promise<RpgProfileValue> {
  const user = ctx.of(User, userId);
  await user.update(RpgProfile, { ...patch, updatedAt: new Date() });
  return user.get(RpgProfile);
}

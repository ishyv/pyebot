import { ErrResult, OkResult, type Result } from "@/core/result";
import { RpgProfileSchema, type RpgProfileData } from "@/db/schemas/rpg-profile";
import { userStore } from "./users";

export { userStore as rpgStore };

export async function getRpgProfile(userId: string): Promise<Result<RpgProfileData | null>> {
  const res = await userStore.get(userId);
  if (res.isErr()) return ErrResult(res.error);
  return OkResult(res.unwrap()?.rpgProfile ?? null);
}

export async function ensureRpgProfile(userId: string): Promise<Result<RpgProfileData>> {
  const res = await userStore.ensure(userId);
  if (res.isErr()) return ErrResult(res.error);
  const user = res.unwrap();
  if (user.rpgProfile) return OkResult(user.rpgProfile);
  const defaultProfile = RpgProfileSchema.parse({});
  const patch = await userStore.updatePaths(userId, { rpgProfile: defaultProfile });
  if (patch.isErr()) return ErrResult(patch.error);
  return OkResult(defaultProfile);
}

/** Patches rpgProfile sub-fields using MongoDB dot-notation paths. */
export async function patchRpgProfile(
  userId: string,
  patch: Partial<RpgProfileData>,
): Promise<Result<RpgProfileData>> {
  const paths: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    paths[`rpgProfile.${key}`] = value;
  }
  const res = await userStore.patch(userId, paths as any);
  if (res.isErr()) return ErrResult(res.error);
  const user = res.unwrap();
  if (!user.rpgProfile) return ErrResult(new Error("rpgProfile not found after patch"));
  return OkResult(user.rpgProfile);
}

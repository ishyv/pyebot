import type { Result } from "@/core/result";
import { type User, UserSchema } from "@/db/schemas/user";
import { MongoStore } from "@/db/store";

export const userStore = new MongoStore("users", UserSchema);

export async function getUser(userId: string): Promise<Result<User | null>> {
  return userStore.get(userId);
}

export async function ensureUser(userId: string): Promise<Result<User>> {
  return userStore.ensure(userId);
}

export async function patchUser(userId: string, patch: Partial<User>): Promise<Result<User>> {
  return userStore.patch(userId, patch);
}

export async function replaceUserIfMatch(
  userId: string,
  expected: Partial<User>,
  next: Partial<User>,
): Promise<Result<User | null>> {
  return userStore.replaceIfMatch(userId, expected, next);
}

export async function updateUserPaths(
  userId: string,
  paths: Record<string, unknown>,
  options?: { upsert?: boolean },
): Promise<Result<void>> {
  return userStore.updatePaths(userId, paths, options);
}

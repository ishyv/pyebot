/**
 * Economy account lifecycle module.
 *
 * Purpose: Manage economy account metadata for users via the user repository.
 * Architecture: Plain exported async functions — no classes.
 * Dependencies: userStore from db/repositories/users, atomicTransition from db/transition.
 *
 * Invariants:
 * - All async functions that can fail return Result<T, Error>.
 * - Account creation is idempotent (ensureAccount).
 * - Status updates use optimistic concurrency (version check).
 * - touchActivity is fire-and-forget — never throws.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { createLogger } from "@/core/logger";
import { atomicTransition } from "@/db/transition";
import { userStore } from "@/db/repositories/users";
import {
  EconomyAccountSchema,
  type EconomyAccountData,
} from "@/db/schemas/economy-account";
import type { User } from "@/db/schemas/user";

export type { AccountStatus } from "@/db/schemas/economy-account";
import type { AccountStatus } from "@/db/schemas/economy-account";

export interface EconomyAccount {
  userId: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  version: number;
}

const logger = createLogger("economy:account");

/** Convert DB data + userId to domain model. */
function toDomain(userId: string, data: EconomyAccountData): EconomyAccount {
  return {
    userId,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastActivityAt: data.lastActivityAt,
    version: data.version,
  };
}

/** Convert domain model to DB data. */
function toData(account: EconomyAccount): EconomyAccountData {
  return {
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastActivityAt: account.lastActivityAt,
    version: account.version,
  };
}

/**
 * Parse economy account from a raw user document.
 * Returns null if no account field is present.
 */
function parseFromUser(userId: string, user: User): EconomyAccount | null {
  const raw = user.economyAccount;
  if (!raw) return null;
  const parsed = EconomyAccountSchema.safeParse(raw);
  if (!parsed.success) return null;
  return toDomain(userId, parsed.data);
}

/**
 * Get economy account for user. Returns null if not initialized.
 */
export async function getAccount(
  userId: string,
): Promise<Result<EconomyAccount | null, Error>> {
  const userRes = await userStore.get(userId);
  if (userRes.isErr()) return ErrResult(userRes.error);
  const user = userRes.unwrap();
  if (!user) return OkResult(null);
  return OkResult(parseFromUser(userId, user));
}

/**
 * Get or create economy account (idempotent).
 * Creates with status="ok" on first call.
 */
export async function ensureAccount(
  userId: string,
): Promise<Result<{ account: EconomyAccount; isNew: boolean }, Error>> {
  // Guarantee the user document exists first
  const userRes = await userStore.ensure(userId);
  if (userRes.isErr()) return ErrResult(userRes.error);
  const user = userRes.unwrap();

  // If account already exists and is valid, return it
  const existing = parseFromUser(userId, user);
  if (existing) {
    return OkResult({ account: existing, isNew: false });
  }

  // Need to create — use atomicTransition for safety
  const now = new Date();
  const newData: EconomyAccountData = {
    status: "ok",
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    version: 0,
  };

  const result = await atomicTransition<
    User,
    EconomyAccountData | undefined,
    EconomyAccountData,
    { account: EconomyAccount; isNew: boolean }
  >({
    attempts: 3,
    getInitial: () => userStore.ensure(userId),
    getFresh: (_prev, _snap) => userStore.ensure(userId),
    getSnapshot: (u) => u.economyAccount,
    computeNext: (snapshot) => {
      // If someone else already created it, use theirs
      if (snapshot) return OkResult(snapshot);
      return OkResult(newData);
    },
    commit: async (expected, next) => {
      // If account already existed when we read, no write needed — fetch current state.
      if (expected !== undefined) {
        const freshRes = await userStore.get(userId);
        if (freshRes.isErr()) return ErrResult(freshRes.error);
        const fresh = freshRes.unwrap();
        if (!fresh) return ErrResult(new Error("User not found after ensure"));
        return OkResult(fresh);
      }
      // Conditional write: set economyAccount only if it is not already present.
      // Uses an aggregation pipeline update so MongoDB evaluates the condition atomically,
      // preventing a concurrent writer from being silently overwritten.
      // NOTE: A small race window remains (two writers both seeing absent, both writing
      // a fresh account with version:0). Since both writes produce functionally equivalent
      // data (status:ok, version:0), the overwrite is benign — no data is lost.
      const patchRes = await userStore.updatePaths(
        userId,
        {},
        {
          upsert: false,
          pipeline: [
            {
              $set: {
                economyAccount: {
                  $ifNull: ["$economyAccount", next],
                },
              },
            },
          ],
        },
      );
      if (patchRes.isErr()) return ErrResult(patchRes.error);
      // Re-fetch to get the committed state (updatePaths returns void).
      const freshRes = await userStore.get(userId);
      if (freshRes.isErr()) return ErrResult(freshRes.error);
      const fresh = freshRes.unwrap();
      if (!fresh) return ErrResult(new Error("User not found after patch"));
      return OkResult(fresh);
    },
    project: (updatedUser, next, expected) => {
      const data = updatedUser.economyAccount ?? next;
      const account = toDomain(userId, data);
      // isNew: true only if we attempted a write (expected was undefined) and the stored
      // account's createdAt matches what we wrote (meaning our write won the race).
      const weWrote = expected === undefined;
      const ourWriteWon =
        weWrote &&
        data.createdAt instanceof Date &&
        data.createdAt.getTime() === next.createdAt.getTime();
      return { account, isNew: ourWriteWon };
    },
    onExhausted: (_lastUser, lastSnapshot) => {
      if (lastSnapshot) {
        return OkResult({ account: toDomain(userId, lastSnapshot), isNew: false });
      }
      return ErrResult(new Error("Failed to initialize economy account after retries"));
    },
  });

  return result;
}

/**
 * Check if account status allows economy usage.
 */
export function isAccountActive(status: AccountStatus): boolean {
  return status === "ok";
}

/**
 * Update account status with version check for optimistic concurrency.
 * Returns null if version doesn't match (concurrent modification).
 */
export async function updateAccountStatus(
  userId: string,
  status: AccountStatus,
  expectedVersion: number,
): Promise<Result<EconomyAccount | null, Error>> {
  const result = await atomicTransition<
    User,
    EconomyAccount | null,
    EconomyAccount,
    EconomyAccount | null
  >({
    attempts: 1, // No retry for version-checked updates — null means conflict
    getInitial: () => userStore.ensure(userId),
    getFresh: (_prev, _snap) => userStore.ensure(userId),
    getSnapshot: (u) => parseFromUser(userId, u),
    computeNext: (current) => {
      if (!current) {
        return ErrResult(new Error("Account does not exist"));
      }
      if (current.version !== expectedVersion) {
        // Version mismatch — signal conflict via null result
        return OkResult(current); // will be detected via version check below
      }
      const next: EconomyAccount = {
        ...current,
        status,
        updatedAt: new Date(),
        version: current.version + 1,
      };
      return OkResult(next);
    },
    commit: async (expected, next) => {
      if (!expected) return OkResult(null);
      // If version didn't change (mismatch case), return null without writing
      if (next.version === expected.version) return OkResult(null);
      return userStore.patch(userId, {
        economyAccount: toData(next),
      } as Partial<User>);
    },
    project: (updatedUser, next, expected) => {
      if (!expected || next.version === expected.version) return null;
      const data = updatedUser.economyAccount;
      if (!data) return null;
      return toDomain(userId, data);
    },
    onExhausted: () => OkResult(null),
  });

  return result;
}

/**
 * Touch last activity timestamp. Fire-and-forget — never throws.
 */
export function touchActivity(userId: string): void {
  const now = new Date();
  userStore
    .updatePaths(userId, { "economyAccount.lastActivityAt": now }, { upsert: false })
    .then((res) => {
      if (res.isErr()) {
        logger.warn(`Failed to touch activity for ${userId}`, res.error);
      }
    })
    .catch((err: unknown) => {
      logger.warn(`Unexpected error touching activity for ${userId}`, err);
    });
}

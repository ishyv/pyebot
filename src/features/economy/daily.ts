/**
 * Daily reward service.
 *
 * Cooldown: guild-configured dailyCooldownHours (default 24h).
 * Streak: tracked in economyAccount.dailyStreak / lastDailyAt.
 * Bonus: dailyStreakBonus * min(streak, dailyStreakCap) extra coins.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { adjustBalance } from "@/features/economy/mutations";
import { ensureAccount } from "@/features/economy/account";
import { userStore } from "@/db/repositories/users";
import { getGuild } from "@/db/repositories/guilds";

export class DailyError extends Error {
  constructor(
    public readonly code: "ON_COOLDOWN" | "UPDATE_FAILED",
    message: string,
    public readonly expiresAt?: number,
  ) {
    super(message);
    this.name = "DailyError";
  }
}

export interface DailyResult {
  readonly base: number;
  readonly streakBonus: number;
  readonly total: number;
  readonly newBalance: number;
  readonly streak: number;
  readonly currencyId: string;
  readonly nextAt: number; // ms epoch
}

export async function claimDaily(
  userId: string,
  guildId: string,
): Promise<Result<DailyResult, DailyError>> {
  // Ensure account exists
  const ensureRes = await ensureAccount(userId);
  if (ensureRes.isErr()) {
    return ErrResult(new DailyError("UPDATE_FAILED", ensureRes.error.message));
  }

  // Load guild config
  const guildRes = await getGuild(guildId);
  const guildConfig = guildRes.isOk() ? guildRes.unwrap()?.economy.daily : undefined;

  const cooldownHours = guildConfig?.dailyCooldownHours ?? 24;
  const baseReward = guildConfig?.dailyReward ?? 250;
  const streakBonus = guildConfig?.dailyStreakBonus ?? 5;
  const streakCap = guildConfig?.dailyStreakCap ?? 10;
  const currencyId = guildConfig?.dailyCurrencyId ?? "coins";
  const cooldownMs = cooldownHours * 60 * 60 * 1000;

  // Check current account for streak info
  const userRes = await userStore.get(userId);
  if (userRes.isErr()) {
    return ErrResult(new DailyError("UPDATE_FAILED", userRes.error.message));
  }

  const user = userRes.unwrap();
  const account = user?.economyAccount;
  const lastDailyAt = account?.lastDailyAt ? new Date(account.lastDailyAt) : null;
  const currentStreak = account?.dailyStreak ?? 0;
  const now = Date.now();

  // Check cooldown
  if (lastDailyAt) {
    const elapsed = now - lastDailyAt.getTime();
    if (elapsed < cooldownMs) {
      const expiresAt = lastDailyAt.getTime() + cooldownMs;
      return ErrResult(
        new DailyError("ON_COOLDOWN", "Daily reward on cooldown", expiresAt),
      );
    }
  }

  // Calculate streak: reset if more than 48h have passed (missed a day)
  const resetStreak = lastDailyAt ? (now - lastDailyAt.getTime()) > 48 * 60 * 60 * 1000 : false;
  const newStreak = resetStreak ? 1 : currentStreak + 1;

  const bonus = streakBonus * Math.min(newStreak, streakCap);
  const total = baseReward + bonus;

  // Apply balance
  const balRes = await adjustBalance(userId, currencyId, total);
  if (balRes.isErr()) {
    return ErrResult(new DailyError("UPDATE_FAILED", balRes.error.message));
  }

  // Update streak on account
  await userStore.updatePaths(userId, {
    "economyAccount.dailyStreak": newStreak,
    "economyAccount.lastDailyAt": new Date(now),
  });

  return OkResult({
    base: baseReward,
    streakBonus: bonus,
    total,
    newBalance: balRes.unwrap().newBalance,
    streak: newStreak,
    currencyId,
    nextAt: now + cooldownMs,
  });
}

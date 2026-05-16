/**
 * Daily reward service.
 */

import { EconomyAccount } from "@/components/economy-account";
import { GuildEconomy } from "@/components/guild-economy";
import { ensureAccount } from "@/features/economy/account";
import { adjustBalance } from "@/features/economy/mutations";
import type { Ctx } from "@/framework/types";

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
  readonly nextAt: number;
}

export async function claimDaily(ctx: Ctx, userId: string, guildId: string): Promise<DailyResult> {
  await ensureAccount(ctx, userId);

  const guildEconomy = await ctx.get(guildId, GuildEconomy);
  const config = guildEconomy?.daily;

  const cooldownMs = (config?.dailyCooldownHours ?? 24) * 60 * 60 * 1000;
  const baseReward = config?.dailyReward ?? 250;
  const streakBonus = config?.dailyStreakBonus ?? 5;
  const streakCap = config?.dailyStreakCap ?? 10;
  const currencyId = config?.dailyCurrencyId ?? "coins";

  const account = await ctx.ensure(userId, EconomyAccount);
  const lastDailyAt = account.lastDailyAt;
  const currentStreak = account.dailyStreak;
  const now = Date.now();

  if (lastDailyAt) {
    const elapsed = now - lastDailyAt.getTime();
    if (elapsed < cooldownMs) {
      throw new DailyError(
        "ON_COOLDOWN",
        "Daily reward on cooldown",
        lastDailyAt.getTime() + cooldownMs,
      );
    }
  }

  const resetStreak = lastDailyAt ? now - lastDailyAt.getTime() > 48 * 60 * 60 * 1000 : false;
  const newStreak = resetStreak ? 1 : currentStreak + 1;
  const bonus = streakBonus * Math.min(newStreak, streakCap);
  const total = baseReward + bonus;

  const newBalance = await adjustBalance(ctx, userId, currencyId, total);

  await ctx.patch(userId, EconomyAccount, { dailyStreak: newStreak, lastDailyAt: new Date(now) });

  return {
    base: baseReward,
    streakBonus: bonus,
    total,
    newBalance,
    streak: newStreak,
    currencyId,
    nextAt: now + cooldownMs,
  };
}

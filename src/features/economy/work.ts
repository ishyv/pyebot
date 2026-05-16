/**
 * Work service — cooldown-gated payout.
 */

import { adjustBalance } from "@/features/economy/mutations";
import type { Ctx } from "@/framework/types";

export class WorkError extends Error {
  constructor(
    public readonly code: "ON_COOLDOWN" | "DAILY_CAP_REACHED",
    message: string,
  ) {
    super(message);
    this.name = "WorkError";
  }
}

export interface WorkConfig {
  readonly cooldownMs: number;
  readonly minPayout: number;
  readonly maxPayout: number;
  readonly currencyId: string;
  readonly dailyCap: number;
}

export const DEFAULT_WORK_CONFIG: WorkConfig = {
  cooldownMs: 60 * 60 * 1000,
  minPayout: 50,
  maxPayout: 200,
  currencyId: "coins",
  dailyCap: 10,
};

export interface WorkResult {
  readonly payout: number;
  readonly currencyId: string;
  readonly newBalance: number;
  readonly cooldownEndsAt: Date;
  readonly worksToday: number;
  readonly dailyCap: number;
}

const WORK_COMMAND = "work";

export async function work(
  ctx: Ctx,
  userId: string,
  config: WorkConfig = DEFAULT_WORK_CONFIG,
): Promise<WorkResult> {
  if (ctx.cooldowns.isOnCooldown(userId, WORK_COMMAND)) {
    const remaining = ctx.cooldowns.getRemainingMs(userId, WORK_COMMAND);
    throw new WorkError(
      "ON_COOLDOWN",
      `On cooldown for ${Math.ceil(remaining / 60000)} more minute(s)`,
    );
  }

  const now = new Date();
  const dateKey = `work_daily:${userId}:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  const worksToday = (ctx.sessions.get(dateKey) as number | undefined) ?? 0;
  if (worksToday >= config.dailyCap) {
    throw new WorkError("DAILY_CAP_REACHED", `Daily work cap of ${config.dailyCap} reached`);
  }

  const payout = Math.floor(
    Math.random() * (config.maxPayout - config.minPayout + 1) + config.minPayout,
  );
  const newBalance = await adjustBalance(ctx, userId, config.currencyId, payout);

  ctx.cooldowns.set(userId, WORK_COMMAND, config.cooldownMs);
  ctx.sessions.set(dateKey, worksToday + 1);

  return {
    payout,
    currencyId: config.currencyId,
    newBalance,
    cooldownEndsAt: new Date(Date.now() + config.cooldownMs),
    worksToday: worksToday + 1,
    dailyCap: config.dailyCap,
  };
}

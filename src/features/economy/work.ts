/**
 * Work service.
 *
 * Purpose: Cooldown-gated work payout. Users earn a random coin reward
 *   with a configurable cooldown and optional daily cap.
 *
 * Architecture: Plain exported async functions.
 * Dependencies: cooldowns from core/state, adjustBalance from mutations.
 *
 * Config defaults:
 * - Cooldown: 60 minutes
 * - Payout: 50–200 coins per work
 * - Daily cap: 10 works per day
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { cooldowns, sessions } from "@/core/state";
import { adjustBalance } from "@/features/economy/mutations";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class WorkError extends Error {
  constructor(
    public readonly code: "ON_COOLDOWN" | "DAILY_CAP_REACHED" | "UPDATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "WorkError";
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WorkConfig {
  readonly cooldownMs: number;
  readonly minPayout: number;
  readonly maxPayout: number;
  readonly currencyId: string;
  readonly dailyCap: number;
}

export const DEFAULT_WORK_CONFIG: WorkConfig = {
  cooldownMs: 60 * 60 * 1000, // 1 hour
  minPayout: 50,
  maxPayout: 200,
  currencyId: "coins",
  dailyCap: 10,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkResult {
  readonly payout: number;
  readonly currencyId: string;
  readonly newBalance: number;
  readonly cooldownEndsAt: Date;
  readonly worksToday: number;
  readonly dailyCap: number;
}

// ---------------------------------------------------------------------------
// work
// ---------------------------------------------------------------------------

// CooldownManager uses (userId, command) as separate keys.
// "work" is the command name; daily cap is tracked via sessions store.
const WORK_COMMAND = "work";

/**
 * Perform work for a user. Enforces cooldown and daily cap.
 * Returns payout details on success.
 */
export async function work(
  userId: string,
  config: WorkConfig = DEFAULT_WORK_CONFIG,
): Promise<Result<WorkResult, WorkError>> {
  // Check cooldown
  if (cooldowns.isOnCooldown(userId, WORK_COMMAND)) {
    const remaining = cooldowns.getRemainingMs(userId, WORK_COMMAND);
    return ErrResult(
      new WorkError("ON_COOLDOWN", `On cooldown for ${Math.ceil(remaining / 60000)} more minute(s)`),
    );
  }

  // Check daily cap using sessions store: value is works done today
  const now = new Date();
  const dateKey = `work_daily:${userId}:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  const worksToday = (sessions.get(dateKey) as number | undefined) ?? 0;
  if (worksToday >= config.dailyCap) {
    return ErrResult(new WorkError("DAILY_CAP_REACHED", `Daily work cap of ${config.dailyCap} reached`));
  }

  // Calculate payout
  const payout = Math.floor(
    Math.random() * (config.maxPayout - config.minPayout + 1) + config.minPayout,
  );

  // Apply payout
  const balanceRes = await adjustBalance(userId, config.currencyId, payout);
  if (balanceRes.isErr()) {
    return ErrResult(new WorkError("UPDATE_FAILED", balanceRes.error.message));
  }

  // Set cooldown and increment daily counter
  cooldowns.set(userId, WORK_COMMAND, config.cooldownMs);
  sessions.set(dateKey, worksToday + 1);

  const cooldownEndsAt = new Date(Date.now() + config.cooldownMs);
  const newWorksToday = worksToday + 1;

  return OkResult({
    payout,
    currencyId: config.currencyId,
    newBalance: balanceRes.unwrap().newBalance,
    cooldownEndsAt,
    worksToday: newWorksToday,
    dailyCap: config.dailyCap,
  });
}

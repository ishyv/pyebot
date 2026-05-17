/**
 * Cooldown middleware.
 *
 * Purpose: Check and set per-user command cooldowns using the global cooldowns manager.
 * Usage (imperative): Call checkCooldown() before executing a command. Call setCooldown() after.
 * Usage (pipeline):   Pass cooldownMiddleware(ms) in a command's middleware array.
 */

import type { MiddlewareFn } from "@/core/feature";
import { ErrResult, OkResult } from "@/core/result";
import { cooldowns } from "@/core/state";

/**
 * Returns remaining cooldown in ms (> 0 means on cooldown), or 0 if not on cooldown.
 */
export function checkCooldown(userId: string, command: string): number {
  if (!cooldowns.isOnCooldown(userId, command)) return 0;
  return cooldowns.getRemainingMs(userId, command);
}

/**
 * Set a cooldown for a user+command after successful execution.
 */
export function setCooldown(userId: string, command: string, durationMs: number): void {
  cooldowns.set(userId, command, durationMs);
}

/**
 * Format remaining cooldown as a human-readable string (e.g. "2m 30s").
 */
export function formatCooldown(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Middleware factory: checks cooldown before execute, sets it after.
 *
 * Usage in a command middleware list:
 *   middleware: [cooldownMiddleware(hoursToMs(1))]
 *
 * The cooldown key is derived from `ctx.commandName` — one key per command per user.
 * For pair-based cooldowns (e.g. rob), use the imperative checkCooldown/setCooldown directly.
 */
export function cooldownMiddleware(durationMs: number): MiddlewareFn {
  return async (_interaction, ctx) => {
    const remaining = checkCooldown(ctx.userId, ctx.commandName);
    if (remaining > 0) {
      return ErrResult({
        content: `You're on cooldown. Try again in **${formatCooldown(remaining)}**.`,
      });
    }
    setCooldown(ctx.userId, ctx.commandName, durationMs);
    return OkResult(undefined);
  };
}

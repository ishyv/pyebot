/**
 * Cooldown middleware.
 *
 * Purpose: Check and set per-user command cooldowns using the global cooldowns manager.
 * Usage: Call checkCooldown() before executing a command. Returns remaining ms if on cooldown.
 *   Call setCooldown() after successful execution.
 */

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

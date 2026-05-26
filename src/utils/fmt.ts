/**
 * Shared formatting utilities for user-facing Discord messages.
 */

export const CURRENCY_EMOJIS: Record<string, string> = {
  coins: "🪙",
  gems: "💎",
  tokens: "🎟️",
  scrip: "⚜️",
};

/** Format a coin amount: `🪙 1,234 Coins` */
export function coins(n: number, currencyId = "coins"): string {
  const emoji = CURRENCY_EMOJIS[currencyId.toLowerCase()] ?? "💰";
  const label = currencyId.charAt(0).toUpperCase() + currencyId.slice(1);
  return `${emoji} ${n.toLocaleString()} ${label}`;
}

/** Discord relative timestamp from a future ms epoch: `<t:1234567890:R>` */
export function relativeTs(ms: number): string {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

/** Block-style progress bar: `████████░░` */
export function progressBar(current: number, max: number, length = 10): string {
  const filled = max > 0 ? Math.round((current / max) * length) : 0;
  const clamped = Math.min(filled, length);
  return "█".repeat(clamped) + "░".repeat(length - clamped);
}

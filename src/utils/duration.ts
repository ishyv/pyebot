const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 days — Discord's maximum timeout

/**
 * Parses a human-readable duration string into milliseconds.
 * Accepts: 10s, 5m, 2h, 3d, 1w
 * Returns null if the input is invalid or exceeds 28 days.
 */
export function parseDuration(input: string): number | null {
  const match = /^(\d+)(s|m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  const ms = n * (multipliers[unit] ?? 0);
  if (ms <= 0 || ms > MAX_TIMEOUT_MS) return null;
  return ms;
}

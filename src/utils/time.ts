/** Formats a millisecond duration as human-readable string (e.g. "1h 30m"). */
export function msToHuman(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

/** Returns the timestamp (ms) when a cooldown of `durationMs` expires from now. */
export function getCooldownExpiry(durationMs: number): number {
  return Date.now() + durationMs;
}

/** Returns true if the given expiry timestamp has passed. */
export function isCooldownExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

/** Converts minutes to milliseconds. */
export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/** Converts hours to milliseconds. */
export function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

/** Converts days to milliseconds. */
export function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

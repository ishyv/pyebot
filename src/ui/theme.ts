/**
 * Accent colour palette for Components V2 containers.
 *
 * Why this exists:
 * - `ContainerBuilder.setAccentColor` takes a single integer per container; this
 *   table is the only source for that value.
 * - Severity-driven views (modlog, automod, appeals) read from here so a "ban"
 *   container is always the same red and a "pardon" is always the same green —
 *   without hex literals scattered across feature files.
 *
 * Hex values match the legacy embed palette from `src/utils/embeds.ts`, which
 * was deleted at the end of the V2 migration. This table is the single colour
 * source for the entire bot.
 */
export const ACCENT = {
  ok: 0x57f287,
  info: 0x5865f2,
  warn: 0xfee75c,
  danger: 0xed4245,
  mute: 0x2b2d31,
} as const;

/** Named accent slots; keys match severity vocabulary used by views. */
export type AccentKey = keyof typeof ACCENT;

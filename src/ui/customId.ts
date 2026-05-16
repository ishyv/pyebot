/**
 * Typed `customId` parsing for button/select interactions.
 *
 * Why this exists:
 * - Every handler currently calls `value.split(":")` and then reads positional
 *   segments. The convention is `feature:action:arg1:arg2…` (see
 *   `docs/ai/engineering-principles.md` "one direct path" rule). This helper
 *   makes that one direct path typed and returns `null` cleanly on mismatch.
 *
 * Boundary:
 * - This file ONLY decodes. Encoders are template-string composition at the
 *   call site (`` `mod:ban:${userId}` ``) because they are simpler than any
 *   helper would make them, and the 100-char Discord limit is naturally
 *   visible at the call site that owns it.
 *
 * Why not a router class:
 * - A router would centralise dispatch but would force every feature to register
 *   handlers through it, which is the kind of ceremony AGENTS.md explicitly
 *   forbids. Dispatch already lives in `src/index.ts`; this helper only
 *   replaces the boilerplate of parsing, not the dispatch model.
 */

/**
 * Parses `value` as a colon-delimited `customId` and returns its segments
 * keyed by the names listed in `layout`. Returns `null` if the segment count
 * does not match `layout.length`, so callers must guard before reading fields.
 *
 * Example:
 * ```ts
 * const parts = parseCustomId(interaction.customId, ["feature", "action", "id"] as const);
 * if (!parts) return;
 * if (parts.feature !== "mod") return;
 * ```
 *
 * Notes:
 * - The first segment is conventionally the feature namespace, but this helper
 *   does not enforce that — naming the first key `feature` in `layout` is the
 *   only convention call sites need to follow.
 * - Trailing empty segments (`"mod:ban:"`) are preserved as empty strings to
 *   keep the count match honest. Callers can treat empty strings as missing.
 */
export function parseCustomId<const Layout extends readonly string[]>(
  value: string,
  layout: Layout,
): Readonly<Record<Layout[number], string>> | null {
  const segments = value.split(":");
  if (segments.length !== layout.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < layout.length; i++) {
    const key = layout[i];
    if (key === undefined) return null;
    out[key] = segments[i] ?? "";
  }
  return out as Readonly<Record<Layout[number], string>>;
}

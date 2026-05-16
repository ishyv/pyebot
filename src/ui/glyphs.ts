/**
 * Visual vocabulary for the bot. Every emoji used by a view must come from here.
 *
 * Why this exists:
 * - Centralises icon choice so severity/status/action glyphs change in one place.
 * - Lets us swap unicode fallbacks for application-owned emoji strings
 *   (`<:name:id>` or `<a:name:id>` for animated) without touching call sites.
 *
 * Application emojis vs unicode:
 * - Application emojis are uploaded once to the Discord application and render
 *   identically on every guild the bot is in, regardless of guild slots. They are
 *   crisp on mobile, where unicode block-drawing characters render inconsistently.
 * - This file ships with unicode fallbacks so the bot works before any emoji is
 *   uploaded. After `bun run glyphs:sync` runs (see scripts/glyphs-sync.ts), the
 *   values here are rewritten in place to their `<:name:id>` form.
 *
 * Invariant:
 * - Every value is a single substitutable emoji string. Both unicode (`🟢`) and
 *   `<:name:id>` satisfy this. No call site should need to know which form is in
 *   use; the value is interpolated into TextDisplay/button labels as-is.
 *
 * Boundary assumption:
 * - Callers pass a literal key (e.g. `GLYPHS.severity.high`). Dynamic keys are
 *   not supported here; use `glyphFor(severity)` style helpers in views if a
 *   feature needs to map domain enums to glyphs.
 */
export const GLYPHS = {
  severity: {
    low: "🟢",
    med: "🟡",
    high: "🟠",
    crit: "🔴",
  },
  status: {
    ok: "✅",
    err: "❌",
    warn: "⚠️",
    loading: "⏳",
  },
  action: {
    approve: "✅",
    reject: "❌",
    edit: "✏️",
    delete: "🗑️",
    undo: "↶",
    back: "◀",
    next: "▶",
  },
  bar: {
    full: "▰",
    empty: "▱",
  },
} as const satisfies Record<string, Record<string, string>>;

/** Top-level glyph categories, derived from the table. */
export type GlyphCategory = keyof typeof GLYPHS;

/** Specific glyph keys within a category, derived from the table. */
export type GlyphKey<C extends GlyphCategory> = keyof (typeof GLYPHS)[C];

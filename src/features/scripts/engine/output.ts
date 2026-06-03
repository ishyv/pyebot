/**
 * Script output DSL — typed tokens scripts return to control how their result
 * is rendered. Constructors are injected as bare names into the worker scope
 * (see exec-worker.ts), so stored scripts use them without any import.
 * Library scripts import them explicitly from the engine barrel.
 *
 * Rendering rules (handled in run.ts):
 *   title()  → ## heading
 *   sep()    → visible horizontal divider (section boundary)
 *   footer() → -# small caption
 *   field()  → **name** — value line
 *   display()→ plain text block
 *   color()  → overrides the container's accent
 *   string[] → bullet list (auto-detected on plain arrays)
 *   object   → key-value block (auto-detected)
 *   string   → plain text (auto-detected)
 */

export type OutputAccent = "ok" | "warn" | "info" | "danger" | "mute";

export type OutputToken =
  | { readonly _t: "title"; readonly text: string }
  | { readonly _t: "color"; readonly accent: OutputAccent }
  | { readonly _t: "sep" }
  | { readonly _t: "footer"; readonly text: string }
  | { readonly _t: "display"; readonly content: string }
  | { readonly _t: "field"; readonly name: string; readonly value: string };

/** Everything that can appear in an output array. */
export type OutputItem = OutputToken | string | readonly string[] | Record<string, unknown>;

export function isOutputToken(value: unknown): value is OutputToken {
  return (
    typeof value === "object" &&
    value !== null &&
    "_t" in value &&
    typeof (value as { _t: unknown })._t === "string"
  );
}

/** Is this value an output array (first element is a token or it contains tokens)? */
export function isOutputArray(value: unknown): value is OutputItem[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.some(isOutputToken);
}

export const title = (text: string): OutputToken => ({ _t: "title", text });
export const color = (accent: OutputAccent): OutputToken => ({ _t: "color", accent });
export const sep = (): OutputToken => ({ _t: "sep" });
export const footer = (text: string): OutputToken => ({ _t: "footer", text });
/** Plain text block (named `display` to avoid clashing with ui/v2's `text` at call sites). */
export const display = (content: string): OutputToken => ({ _t: "display", content });
export const field = (name: string, value: string): OutputToken => ({ _t: "field", name, value });

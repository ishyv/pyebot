/**
 * Script input DSL — lets scripts declare what values they need before running.
 *
 * Call `input.<type>(name, label, opts?)` anywhere in the script body. These calls
 * are **pre-scanned** from the transpiled JS via regex on the main thread before
 * the worker starts. The runtime then shows a collector (select menus for
 * role/member/channel, a modal for text/number); the values arrive in `ctx.input`
 * as strings (entity types arrive as Discord IDs — use `ctx.find_role`, etc.).
 *
 * At runtime inside the worker, `input` is a no-op object — the declarations were
 * already collected. Only calls with string-literal name/label are detected; dynamic
 * constructions (e.g. `input.text(myVar, ...)`) are silently ignored.
 */

export type InputType = "text" | "number" | "role" | "member" | "channel";

export interface InputFieldOpts {
  readonly required?: boolean;
  readonly placeholder?: string;
}

export interface InputField {
  readonly name: string;
  readonly type: InputType;
  readonly label: string;
  readonly required: boolean;
  readonly placeholder: string;
}

// Matches: input.<type>("name", "label") with any quote style.
// Captures (1) type, (2) field name, (3) label.
const INPUT_CALL_RE =
  /\binput\.(text|number|role|member|channel)\s*\(\s*["'`]([^"'`\r\n]+)["'`]\s*,\s*["'`]([^"'`\r\n]+)["'`]/g;

// Field names become part of component customIds, so keep them to safe identifiers.
const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Scans already-transpiled JS for `input.<type>(...)` calls and returns the
 * declared fields in declaration order. Run this on the output of `Bun.Transpiler`
 * so that TypeScript syntax doesn't interfere.
 *
 * Fields with a non-identifier name are skipped; duplicate names are de-duped
 * (first occurrence wins).
 */
export function scanInputs(code: string): InputField[] {
  const fields: InputField[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  INPUT_CALL_RE.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard RegExp.exec loop
  while ((match = INPUT_CALL_RE.exec(code)) !== null) {
    const type = match[1] as InputType;
    const name = match[2].trim();
    const label = match[3].trim();
    if (!NAME_RE.test(name) || seen.has(name)) continue;
    seen.add(name);
    fields.push({ name, type, label, required: true, placeholder: "" });
  }
  return fields;
}

/** Returns an error string if a required input is missing or a number is malformed. */
export function validateInputValues(
  fields: InputField[],
  values: Record<string, string>,
): string | null {
  for (const f of fields) {
    const value = values[f.name]?.trim() ?? "";
    if (!value) {
      if (f.required) return `**${f.label}** is required.`;
      continue;
    }
    if (f.type === "number" && Number.isNaN(Number(value))) {
      return `**${f.label}** must be a number.`;
    }
  }
  return null;
}

/**
 * No-op `input` object injected into the worker scope. Calling `input.<type>(...)`
 * at runtime does nothing — declarations were already collected by `scanInputs`.
 */
type InputFn = (name: string, label: string, opts?: InputFieldOpts) => void;
export const input: Record<InputType, InputFn> = {
  text: () => {},
  number: () => {},
  role: () => {},
  member: () => {},
  channel: () => {},
};

// ─── fail_input ───────────────────────────────────────────────────────────────

/** Sentinel prefix marking a fail_input rejection so the collector shows a retry. */
const FAIL_INPUT_MARKER = "␞";

/**
 * Rejects the current inputs with a friendly message and re-opens the collector.
 * Injected as a bare name in the worker. Throws — nothing after it runs.
 */
export function fail_input(message: string): never {
  throw new Error(FAIL_INPUT_MARKER + message);
}

/** Returns the clean message if this error came from `fail_input`, else null. */
export function asInputError(errorMessage: string): string | null {
  return errorMessage.startsWith(FAIL_INPUT_MARKER)
    ? errorMessage.slice(FAIL_INPUT_MARKER.length)
    : null;
}

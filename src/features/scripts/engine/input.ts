/**
 * Script input DSL — lets scripts declare what values they need before running.
 *
 * Call `input.text(name, label, opts?)` anywhere in the script body. These calls
 * are **pre-scanned** from the transpiled JS via regex on the main thread before
 * the worker starts. When fields are found, the runtime shows a form modal; the
 * submitted values arrive in `ctx.input`.
 *
 * At runtime inside the worker, `input` is a no-op object — the declarations have
 * already been collected. Only `input.text(...)` calls with string-literal arguments
 * will be detected by the scan. Dynamic constructions (e.g. `input.text(myVar, ...)`)
 * are silently ignored.
 */

export interface InputFieldOpts {
  readonly required?: boolean;
  readonly placeholder?: string;
}

export interface InputField {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly placeholder: string;
}

// Matches: input.text("name", "label") with any quote style.
// Captures (1) field name and (2) label.
const INPUT_TEXT_RE = /\binput\.text\s*\(\s*["'`]([^"'`\r\n]+)["'`]\s*,\s*["'`]([^"'`\r\n]+)["'`]/g;

/**
 * Scans already-transpiled JS for `input.text(...)` calls and returns the
 * declared fields in declaration order. Run this on the output of `Bun.Transpiler`
 * so that TypeScript syntax (type annotations, etc.) doesn't interfere.
 *
 * Duplicate field names are silently de-duped (first occurrence wins).
 */
export function scanInputs(code: string): InputField[] {
  const fields: InputField[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  INPUT_TEXT_RE.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard RegExp.exec loop
  while ((match = INPUT_TEXT_RE.exec(code)) !== null) {
    const name = match[1].trim();
    const label = match[2].trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    fields.push({ name, label, required: true, placeholder: "" });
  }
  return fields;
}

/**
 * No-op `input` object injected into the worker scope. Calling `input.text(...)`
 * at runtime does nothing — declarations were already collected by `scanInputs`
 * before the worker started.
 */
export const input: { text(name: string, label: string, opts?: InputFieldOpts): void } = {
  text: () => {},
};

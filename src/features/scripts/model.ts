/**
 * Input parsing for the `/script` surface: names and capability lists.
 */
import { SCRIPT_CAPABILITIES } from "@/components/script-definition";
import type { Capability } from "./engine";

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** Normalizes and validates a script name (lowercase, alnum + `-`/`_`). */
export function parseScriptName(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  return NAME_RE.test(name) ? name : null;
}

export type CapabilityParse =
  | { readonly ok: true; readonly value: Capability[] }
  | { readonly ok: false; readonly invalid: string[] };

/** Parses a comma-separated capability list, rejecting unknown entries. */
export function parseCapabilities(raw: string | null): CapabilityParse {
  if (!raw?.trim()) return { ok: true, value: [] };
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const known = SCRIPT_CAPABILITIES as readonly string[];
  const invalid = parts.filter((p) => !known.includes(p));
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, value: [...new Set(parts)] as Capability[] };
}

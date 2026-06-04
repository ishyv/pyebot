/**
 * Runtime decode for component customIds.
 *
 * Given a route's schema and the segment tail of an incoming customId (everything
 * after the `ns:route:` prefix), produce a name→value record of typed args, or
 * `null` to signal "skip this interaction" — the frequent stale/garbled-button
 * path. This is layer one of the two-layer skip model: a `null` here means the id
 * itself is unroutable. Session-expiry (the id decoded fine but a registry lookup
 * misses) is layer two and stays the handler's concern.
 */

import type { Codec } from "./codecs";

/**
 * A route's field schema. The value type is `Codec<any>` (not `Codec<unknown>`)
 * on purpose: `Codec` is contravariant in its type parameter (`encode(value: T)`),
 * so `Codec<string>` is NOT assignable to `Codec<unknown>` under strict function
 * types. `any` lets a concrete schema like `{ id: Codec<string> }` satisfy the
 * constraint, while `ArgsOf<S>` still recovers each field's real type via `infer`.
 */
// biome-ignore lint/suspicious/noExplicitAny: variance — see doc comment above.
export type Schema = Record<string, Codec<any>>;

/**
 * Decode `remainder` (the customId tail after `ns:route:`) against `schema`.
 * Fields map positionally in declaration order; a trailing greedy field (`rest`)
 * absorbs any remaining colons. Returns `null` on arity mismatch or any codec
 * rejecting its segment.
 */
export function decodeArgs(schema: Schema, remainder: string): Record<string, unknown> | null {
  const fields = Object.keys(schema);
  const lastName = fields[fields.length - 1];
  const greedy = lastName !== undefined && schema[lastName]?.greedy === true;

  let segments: string[];
  if (remainder === "") {
    segments = [];
  } else if (greedy) {
    segments = splitWithRemainder(remainder, fields.length);
  } else {
    segments = remainder.split(":");
  }

  if (segments.length !== fields.length) return null;

  const out: Record<string, unknown> = {};
  for (let i = 0; i < fields.length; i++) {
    const name = fields[i] as string;
    const value = (schema[name] as Codec<unknown>).decode(segments[i] as string);
    if (value === null) return null;
    out[name] = value;
  }
  return out;
}

/**
 * Split `value` into exactly `count` parts where the final part keeps any extra
 * colons. If there are fewer than `count` segments, returns a plain split so the
 * caller's arity check fails (and the interaction is skipped).
 */
function splitWithRemainder(value: string, count: number): string[] {
  if (count <= 0) return [];
  const parts: string[] = [];
  let rest = value;
  for (let i = 0; i < count - 1; i++) {
    const idx = rest.indexOf(":");
    if (idx === -1) return value.split(":");
    parts.push(rest.slice(0, idx));
    rest = rest.slice(idx + 1);
  }
  parts.push(rest);
  return parts;
}

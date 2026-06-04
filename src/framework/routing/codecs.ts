/**
 * Codecs — the typed building blocks of a component `customId`.
 *
 * A `Codec<T>` knows how to turn one typed value to/from a single colon-delimited
 * segment of a customId. Routes are declared as a record of named codecs (a
 * "schema"); the framework uses them to ENCODE typed args into a string and to
 * DECODE an incoming string back into typed args before a handler runs.
 *
 * Boundary: a codec owns exactly one segment of the `customId` string and nothing
 * else. User-supplied runtime data (a select menu's `interaction.values`, a
 * modal's `interaction.fields`) is NOT encoded here — those are separate channels
 * the handler reads directly.
 *
 * Colons: segments are joined with ":", so a non-greedy value may not contain a
 * colon. `encode` throws if it does — that is an authoring bug (corrupted routing)
 * we want to surface loudly rather than silently mis-split on decode. The one
 * exception is `rest`, a greedy codec that must be the last field and absorbs any
 * remaining colons (mirrors the old `action.join(":")` panel/embeds behavior).
 */

export interface Codec<T> {
  /** Serialize a typed value to one customId segment. Throws on an un-encodable value. */
  readonly encode: (value: T) => string;
  /** Parse one segment back to the typed value, or `null` if it does not match. */
  readonly decode: (raw: string) => T | null;
  /** Greedy codecs consume all remaining segments. Only valid as the last field. */
  readonly greedy?: boolean;
}

function assertNoColon(value: string): string {
  if (value.includes(":")) {
    throw new Error(
      `Cannot encode "${value}" into a customId segment: it contains ":". ` +
        `Use the rest() codec for the final field if a value may contain colons.`,
    );
  }
  return value;
}

/** A plain string segment. May not contain ":" (use rest() for that). */
export const str: Codec<string> = {
  encode: assertNoColon,
  decode: (raw) => raw,
};

/** An integer segment. Decodes to `null` for non-integers. */
export const int: Codec<number> = {
  encode: (value) => String(value),
  decode: (raw) => {
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : null;
  },
};

/** A Discord snowflake (1–20 digits). Validates on both encode and decode. */
export const snowflake: Codec<string> = {
  encode: (value) => {
    if (!/^\d{1,20}$/.test(value)) {
      throw new Error(`Cannot encode "${value}" as a snowflake: expected 1–20 digits.`);
    }
    return value;
  },
  decode: (raw) => (/^\d{1,20}$/.test(raw) ? raw : null),
};

/** A closed set of string literals. Decodes to `null` for anything outside the set. */
export function oneOf<const T extends readonly string[]>(values: T): Codec<T[number]> {
  const allowed = new Set<string>(values);
  return {
    encode: (value) => assertNoColon(value),
    decode: (raw) => (allowed.has(raw) ? (raw as T[number]) : null),
  };
}

/**
 * A greedy trailing string that absorbs every remaining segment (colons included).
 * Must be the LAST field in a schema. Use for free-form action tails — the typed
 * replacement for the old `parts.join(":")` pattern.
 */
export const rest: Codec<string> = {
  encode: (value) => value,
  decode: (raw) => raw,
  greedy: true,
};

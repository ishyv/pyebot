/** Moderator-facing text rule stored under guild AutoMod config. */
export interface AutomodTextRule {
  readonly id: string;
  readonly enabled: boolean;
  readonly phrases: readonly string[];
  readonly action: "delete" | "timeout" | "report";
  readonly timeoutSeconds: number;
}

/** The first plain-text rule hit for a message, including the observed text. */
export interface TextRuleMatch {
  readonly rule: AutomodTextRule;
  readonly matchedText: string;
}

const WORD_BOUNDARY = "[a-z0-9]";
const SAME_SEPARATOR = "[\\s\\p{P}\\p{S}_\\u200B-\\u200D\\uFEFF]";
const PHRASE_SEPARATOR = "[\\s\\W_\\u200B-\\u200D\\uFEFF]+";

const LEET_CHARS: Record<string, string> = {
  a: "a@4",
  e: "e3",
  i: "i1!|",
  o: "o0",
  s: "s$5",
  t: "t7",
};

function escapeRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function charPattern(char: string): string {
  const lower = char.toLowerCase();
  const variants = LEET_CHARS[lower];
  if (!variants) return escapeRegex(char);
  return `[${escapeRegex(variants)}]`;
}

function wordPattern(word: string, groupId: number): string {
  const chars = [...word];
  const contiguous = chars.map(charPattern).join("");
  if (chars.length < 2) return contiguous;

  const separatorGroup = `sep${groupId}`;
  const separated = [
    charPattern(chars[0] ?? ""),
    `(?<${separatorGroup}>${SAME_SEPARATOR})(?:\\k<${separatorGroup}>)*`,
    charPattern(chars[1] ?? ""),
    ...chars.slice(2).flatMap((char) => [`(?:\\k<${separatorGroup}>)+`, charPattern(char)]),
  ].join("");

  return `(?:${contiguous}|${separated})`;
}

function phrasePattern(phrase: string, phraseIndex: number): string | null {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words
    .map((word, index) => wordPattern(word, phraseIndex * 100 + index))
    .join(PHRASE_SEPARATOR);
}

/**
 * Compiles moderator-entered phrases into the supported evasion-aware regex.
 * The only intentional fuzzy form is one repeated separator character between
 * letters; mixed separators are ignored to avoid broad accidental matches.
 */
export function compileTextRule(rule: AutomodTextRule): RegExp | null {
  const bodies = rule.phrases
    .map((phrase, index) => phrasePattern(phrase, index))
    .filter((body): body is string => Boolean(body));
  if (bodies.length === 0) return null;

  const body = bodies.join("|");
  return new RegExp(`(?<!${WORD_BOUNDARY})(?:${body})(?!${WORD_BOUNDARY})`, "iu");
}

/** Finds the first enabled text rule whose phrase appears in the supplied content. */
export function findTextRuleMatch(
  content: string,
  rules: readonly AutomodTextRule[],
): TextRuleMatch | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const regex = compileTextRule(rule);
    const match = regex?.exec(content);
    if (match) return { rule, matchedText: match[0] };
  }
  return null;
}

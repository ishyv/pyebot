/**
 * Validated runtime configuration — the single place the bot reads its
 * environment.
 *
 * `loadEnv()` is called once at startup (`src/index.ts`). It parses every
 * variable the bot understands and asserts the ones the bundled bot cannot run
 * without, so a misconfigured deploy fails immediately with one clear message
 * instead of a confusing error thrown deep in a request path later.
 *
 * Everywhere else, read config through `getEnv()` — never touch `process.env`
 * directly. `getEnv()` is deliberately lenient: it returns a fully-typed object
 * and never throws, so importing any module (in tests, the feature loader, etc.)
 * can't blow up on an unset token. The boot-time *requirements* live in
 * `loadEnv()`, not in the schema — that keeps "shape & types" separate from
 * "what a real deploy must provide".
 *
 * Two known exceptions intentionally bypass this module:
 *   - `core/logger.ts` reads `DEBUG` directly, since it logs before env loads.
 *   - `webapp/server.ts` *writes* `process.env.ORIGIN` for the SvelteKit
 *     adapter, which reads it at its own module load.
 */
import { z } from "zod";

/** An optional string where blank / whitespace-only is normalised to `undefined`. */
const optionalString = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

const EnvSchema = z.object({
  // Core Discord + database
  DISCORD_TOKEN: optionalString,
  MONGO_URI: optionalString,
  DB_NAME: z
    .string()
    .optional()
    .transform((v) => v?.trim() || "txbot"),
  CLIENT_ID: optionalString,
  GUILD_ID: optionalString,

  // Dashboard
  WEBAPP: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  WEBAPP_PORT: z.coerce.number().int().positive().catch(4000),
  ORIGIN: optionalString,
  DISCORD_REDIRECT_URI: optionalString,

  // Logging
  DEBUG: z
    .string()
    .optional()
    .transform((v) => Boolean(v?.trim())),

  // AI providers (any subset; AI commands degrade gracefully when unset)
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
});

export type Env = z.infer<typeof EnvSchema>;

/** Keys the bundled bot cannot start without. `loadEnv()` fails fast if any is unset. */
const REQUIRED_AT_BOOT = ["DISCORD_TOKEN", "MONGO_URI"] as const satisfies ReadonlyArray<keyof Env>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvValidationError";
  }
}

/**
 * Parse `raw` into the typed `Env`. Every field is forgiving (optional or
 * `.catch`), so this never throws — it only normalises and coerces.
 */
export function parseEnv(raw: Record<string, string | undefined> = process.env): Env {
  return EnvSchema.parse(raw);
}

let cached: Env | null = null;

/** The validated config. Parses lazily on first use; never throws. */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}

/**
 * Parse, cache, and enforce the boot-time requirements. Call once at startup.
 * Throws `EnvValidationError` listing every missing required key. A value left
 * as an `.env.example` `your_*` placeholder counts as missing.
 */
export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  cached = parseEnv(raw);
  const missing = REQUIRED_AT_BOOT.filter((key) => {
    const value = cached?.[key];
    return typeof value !== "string" || value.includes("your_");
  });
  if (missing.length > 0) {
    throw new EnvValidationError(
      missing.map((key) => `${key} is required but missing, blank, or still a placeholder`),
    );
  }
  return cached;
}

/** Test/reset hook — drops the memoised parse so the next access re-reads env. */
export function resetEnvCache(): void {
  cached = null;
}

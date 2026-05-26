import { afterEach, describe, expect, test } from "bun:test";
import { EnvValidationError, loadEnv, parseEnv, resetEnvCache } from "./env";

const minimal = { DISCORD_TOKEN: "token-123", MONGO_URI: "mongodb://localhost:27017" };

// loadEnv() writes the module-level cache, which is shared across all test
// files. Clear it after each test so this file never leaks a fixture URI into
// another suite's getEnv().
afterEach(resetEnvCache);

describe("parseEnv", () => {
  test("applies defaults for unset optional vars", () => {
    const env = parseEnv(minimal);
    expect(env.DB_NAME).toBe("txbot");
    expect(env.WEBAPP_PORT).toBe(4000);
    expect(env.WEBAPP).toBe(false);
    expect(env.DEBUG).toBe(false);
    expect(env.CLIENT_ID).toBeUndefined();
  });

  test("normalises blank / whitespace strings to undefined", () => {
    const env = parseEnv({ ...minimal, CLIENT_ID: "   ", GUILD_ID: "" });
    expect(env.CLIENT_ID).toBeUndefined();
    expect(env.GUILD_ID).toBeUndefined();
  });

  test("coerces WEBAPP_PORT and reads WEBAPP/DEBUG as booleans", () => {
    const env = parseEnv({ ...minimal, WEBAPP: "true", WEBAPP_PORT: "5000", DEBUG: "1" });
    expect(env.WEBAPP).toBe(true);
    expect(env.WEBAPP_PORT).toBe(5000);
    expect(env.DEBUG).toBe(true);
  });

  test("falls back to 4000 for an unparseable port", () => {
    expect(parseEnv({ ...minimal, WEBAPP_PORT: "not-a-number" }).WEBAPP_PORT).toBe(4000);
  });

  test("never throws on missing required vars (lenient)", () => {
    expect(() => parseEnv({})).not.toThrow();
    expect(parseEnv({}).DISCORD_TOKEN).toBeUndefined();
  });
});

describe("loadEnv", () => {
  test("returns the parsed env when required vars are present", () => {
    resetEnvCache();
    const env = loadEnv(minimal);
    expect(env.DISCORD_TOKEN).toBe("token-123");
    expect(env.MONGO_URI).toBe("mongodb://localhost:27017");
  });

  test("throws listing every missing required var", () => {
    resetEnvCache();
    expect(() => loadEnv({})).toThrow(EnvValidationError);
    try {
      loadEnv({});
    } catch (err) {
      const issues = (err as EnvValidationError).issues;
      expect(issues.some((i) => i.includes("DISCORD_TOKEN"))).toBe(true);
      expect(issues.some((i) => i.includes("MONGO_URI"))).toBe(true);
    }
  });

  test("treats an unfilled your_* placeholder as missing", () => {
    resetEnvCache();
    expect(() => loadEnv({ ...minimal, DISCORD_TOKEN: "your_token_here" })).toThrow(
      EnvValidationError,
    );
  });
});

import { describe, expect, test } from "vitest";
import { requireEnv } from "./auth";

const validEnv = {
  MONGO_URI: "mongodb://localhost:27017",
  DB_NAME: "txbot",
  DISCORD_CLIENT_ID: "772501208422154250",
  DISCORD_CLIENT_SECRET: "oauth-secret",
  SESSION_SECRET: "session-secret",
};

describe("requireEnv", () => {
  test("returns the dashboard env when every required value is present", () => {
    expect(requireEnv(validEnv)).toEqual(validEnv);
  });

  test("rejects token-shaped Discord client ids", () => {
    expect(() =>
      requireEnv({
        ...validEnv,
        DISCORD_CLIENT_ID: "772501208422154250.token.signature",
      }),
    ).toThrow("DISCORD_CLIENT_ID must be the numeric Discord application client id");
  });

  test("rejects token-shaped Discord client secrets", () => {
    expect(() =>
      requireEnv({
        ...validEnv,
        DISCORD_CLIENT_SECRET: "token.segment.signature",
      }),
    ).toThrow("DISCORD_CLIENT_SECRET must be the OAuth client secret, not the bot token");
  });
});

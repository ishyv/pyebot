import { trace } from "@opentelemetry/api";
import type { Cookies } from "@sveltejs/kit";
import { describe, expect, test, vi } from "vitest";
import { exchangeDiscordCode } from "$lib/server/discord";
import { createSession } from "$lib/server/session";
import { GET } from "./+server";
import type { RequestEvent } from "./$types";

type RejectableMock = {
  mockRejectedValue(error: unknown): void;
};

vi.mock("$lib/server/auth", () => ({
  requireEnv: () => ({
    MONGO_URI: "mongodb://localhost:27017",
    DB_NAME: "txbot",
    DISCORD_CLIENT_ID: "1417969302140616795",
    DISCORD_CLIENT_SECRET: "secret",
    SESSION_SECRET: "session-secret",
  }),
}));

vi.mock("$lib/server/oauth", () => ({
  tokenExpiresAt: () => "2026-06-03T00:00:00.000Z",
  validateOAuthState: () => true,
}));

vi.mock("$lib/server/discord", () => ({
  discordAvatarUrl: () => null,
  exchangeDiscordCode: vi.fn(),
  fetchDiscordUser: vi.fn(),
}));

vi.mock("$lib/server/session", () => ({
  createSession: vi.fn(),
}));

function makeCookies(): Cookies {
  return {
    delete: vi.fn(),
    get: vi.fn(() => "cookie-state"),
    getAll: vi.fn(() => []),
    serialize: vi.fn(() => ""),
    set: vi.fn(),
  };
}

function makeEvent(): RequestEvent {
  const url = new URL(
    "http://localhost:4000/auth/discord/callback?code=bad-code&state=returned-state",
  );
  const span = trace.getTracer("oauth-callback-test").startSpan("request");
  return {
    cookies: makeCookies(),
    fetch: vi.fn(),
    getClientAddress: () => "127.0.0.1",
    isDataRequest: false,
    isRemoteRequest: false,
    isSubRequest: false,
    locals: { session: null },
    params: {},
    platform: undefined,
    request: new Request(url),
    route: { id: "/auth/discord/callback" },
    setHeaders: vi.fn(),
    tracing: { enabled: false, root: span, current: span },
    url,
  };
}

describe("Discord OAuth callback", () => {
  test("redirects to login when Discord rejects the code exchange", async () => {
    (exchangeDiscordCode as unknown as RejectableMock).mockRejectedValue(
      new Error("Discord OAuth exchange failed: 401"),
    );

    await expect(GET(makeEvent())).rejects.toMatchObject({
      status: 303,
      location: "/login?error=oauth_exchange_failed",
    });

    expect(createSession).not.toHaveBeenCalled();
  });
});

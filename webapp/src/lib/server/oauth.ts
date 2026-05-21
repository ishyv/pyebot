import crypto from "node:crypto";
import type { DashboardEnv } from "./auth";

const STATE_TTL_MS = 10 * 60_000;
const TOKEN_REFRESH_SKEW_MS = 60_000;

export type OAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createOAuthState(
  secret: string,
  now = Date.now(),
): { value: string; cookieValue: string; expiresAt: Date } {
  const nonce = crypto.randomBytes(24).toString("base64url");
  const payload = `${nonce}.${now}`;
  return {
    value: nonce,
    cookieValue: `${payload}.${sign(payload, secret)}`,
    expiresAt: new Date(now + STATE_TTL_MS),
  };
}

export function validateOAuthState(
  cookieValue: string | undefined,
  returnedState: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!cookieValue || !returnedState) return false;

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [nonce, issuedAtRaw, signature] = parts;
  const payload = `${nonce}.${issuedAtRaw}`;
  if (sign(payload, secret) !== signature) return false;
  if (nonce !== returnedState) return false;

  const issuedAt = Number(issuedAtRaw);
  return Number.isFinite(issuedAt) && now - issuedAt <= STATE_TTL_MS;
}

export function buildDiscordAuthorizeUrl(
  env: DashboardEnv,
  state: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state,
    // No `prompt: "none"` — Discord must be allowed to re-prompt for consent
    // when the requested scope set changes. With `prompt=none`, a user who
    // previously authorized this app with a narrower scope would silently get
    // a token missing `guilds`, and /users/@me/guilds would 401.
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function tokenExpiresAt(expiresInSeconds: number, now = Date.now()): string {
  return new Date(now + expiresInSeconds * 1000).toISOString();
}

export function isTokenExpired(expiresAt: string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() - now <= TOKEN_REFRESH_SKEW_MS;
}

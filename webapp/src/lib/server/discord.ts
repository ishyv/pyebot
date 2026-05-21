/**
 * Discord REST helpers used only by the OAuth flow.
 *
 * Per-guild reads (channels, roles, members) go through the bot bridge so the
 * webapp never needs a bot token and never makes redundant Discord calls.
 */

import { type DiscordUserGuild, requireEnv } from "./auth";
import type { OAuthTokenResponse } from "./oauth";

const DISCORD_API = "https://discord.com/api/v10";

async function bearerFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Discord ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function exchangeDiscordCode(
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResponse> {
  const env = requireEnv();
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok) {
    throw new Error(`Discord OAuth exchange failed: ${response.status}`);
  }
  return (await response.json()) as OAuthTokenResponse;
}

export async function refreshDiscordAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
  const env = requireEnv();
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok) {
    throw new Error(`Discord OAuth refresh failed: ${response.status}`);
  }
  return (await response.json()) as OAuthTokenResponse;
}

export async function fetchDiscordUser(
  accessToken: string,
): Promise<{ id: string; username: string; avatar: string | null }> {
  return bearerFetch("/users/@me", accessToken);
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordUserGuild[]> {
  return bearerFetch("/users/@me/guilds", accessToken);
}

export function discordAvatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=80`;
}

export function discordGuildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=128`;
}

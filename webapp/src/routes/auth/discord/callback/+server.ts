import { redirect } from "@sveltejs/kit";
import { requireEnv } from "$lib/server/auth";
import { discordAvatarUrl, exchangeDiscordCode, fetchDiscordUser } from "$lib/server/discord";
import { tokenExpiresAt, validateOAuthState } from "$lib/server/oauth";
import { createSession } from "$lib/server/session";

const STATE_COOKIE = "tx_dashboard_oauth_state";

export async function GET({ cookies, url }) {
  const env = requireEnv();
  const redirectUri = process.env.DISCORD_REDIRECT_URI ?? `${url.origin}/auth/discord/callback`;
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookieState = cookies.get(STATE_COOKIE);
  cookies.delete(STATE_COOKIE, { path: "/auth/discord" });

  if (!code) {
    throw redirect(303, "/login?error=missing_code");
  }
  if (!validateOAuthState(cookieState, returnedState, env.SESSION_SECRET)) {
    throw redirect(303, "/login?error=invalid_state");
  }

  const token = await exchangeDiscordCode(code, redirectUri);
  const user = await fetchDiscordUser(token.access_token);
  await createSession(cookies, {
    userId: user.id,
    username: user.username,
    avatarUrl: discordAvatarUrl(user.id, user.avatar),
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? "",
    tokenExpiresAt: tokenExpiresAt(token.expires_in),
    scope: token.scope ?? "identify guilds",
  });

  throw redirect(303, "/guilds");
}

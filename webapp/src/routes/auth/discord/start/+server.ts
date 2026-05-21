import { redirect } from "@sveltejs/kit";
import { requireEnv } from "$lib/server/auth";
import { buildDiscordAuthorizeUrl, createOAuthState } from "$lib/server/oauth";

const STATE_COOKIE = "tx_dashboard_oauth_state";

export function GET({ cookies, url }) {
  const env = requireEnv();
  const redirectUri = process.env.DISCORD_REDIRECT_URI ?? `${url.origin}/auth/discord/callback`;
  const state = createOAuthState(env.SESSION_SECRET);
  cookies.set(STATE_COOKIE, state.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/discord",
    expires: state.expiresAt,
  });

  throw redirect(303, buildDiscordAuthorizeUrl(env, state.value, redirectUri));
}

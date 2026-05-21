/**
 * Guild access guard. Asserts the signed-in user has management permission in
 * the requested guild AND that the bot itself is in that guild.
 */

import { error } from "@sveltejs/kit";
import { type DashboardSession, hasGuildManagementPermission } from "./auth";
import { getBridge, hasBridge } from "./bridge";
import { fetchUserGuildsCached } from "./guildsCache";

export async function requireGuildAccess(
  session: DashboardSession | null,
  guildId: string,
): Promise<void> {
  if (!session) throw error(401, "Authentication required.");

  // Cached: Discord rate-limits /users/@me/guilds aggressively per token. This
  // gate is hit from every page loader + SSE stream + API call, so an
  // uncached path 429s within a few clicks. See guildsCache.ts.
  const userGuilds = await fetchUserGuildsCached(session.accessToken);
  const userGuild = userGuilds.find((g) => g.id === guildId);
  if (!userGuild || !hasGuildManagementPermission(userGuild)) {
    throw error(403, "You do not have access to this server.");
  }

  if (!hasBridge()) throw error(503, "Bot bridge unavailable.");
  const status = await getBridge().getGuildStatus(guildId);
  if (status.isErr()) throw error(404, "Bot is not in this server.");
}

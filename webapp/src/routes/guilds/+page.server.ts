import { hasGuildManagementPermission, requireEnv } from "$lib/server/auth";
import { getBridge, hasBridge } from "$lib/server/bridge";
import { discordGuildIconUrl } from "$lib/server/discord";
import { fetchUserGuildsCached } from "$lib/server/guildsCache";
import type { PageServerLoad } from "./$types";

const debug = process.env.DEBUG_GUILDS === "1";
const log = (msg: string) => {
  if (debug) console.log(msg);
};

/** Why the rendered guild list is empty — drives the user-facing copy. */
export type EmptyReason = "no-session" | "no-user-guilds" | "no-manageable" | "bot-unavailable";

export const load: PageServerLoad = async ({ locals }) => {
  const { DISCORD_CLIENT_ID: clientId } = requireEnv();

  if (!locals.session) {
    log("[guilds] no session on locals — should have been redirected by hooks");
    return { guilds: [], botUnavailable: false, reason: "no-session" as EmptyReason, clientId };
  }
  log(
    `[guilds] session userId=${locals.session.userId} scope="${locals.session.scope}" tokenExpiresAt=${locals.session.tokenExpiresAt}`,
  );

  let userGuilds: Awaited<ReturnType<typeof fetchUserGuildsCached>>;
  try {
    userGuilds = await fetchUserGuildsCached(locals.session.accessToken);
  } catch (err) {
    log(`[guilds] fetchUserGuildsCached threw: ${err instanceof Error ? err.message : err}`);
    throw err;
  }
  log(`[guilds] fetched userGuilds.length=${userGuilds.length}`);

  const manageable = userGuilds.filter((g) => hasGuildManagementPermission(g));
  const ownerCount = userGuilds.filter((g) => g.owner === true).length;
  log(
    `[guilds] manageable.length=${manageable.length} (owner=${ownerCount}, others=${manageable.length - ownerCount})`,
  );

  if (!hasBridge()) {
    log("[guilds] hasBridge()=false — bot bridge not registered");
    return {
      guilds: [],
      botUnavailable: true,
      reason: "bot-unavailable" as EmptyReason,
      clientId,
    };
  }

  const bridge = getBridge();
  const enriched = await Promise.all(
    manageable.map(async (g) => {
      const status = await bridge.getGuildStatus(g.id);
      if (status.isErr()) {
        log(`[guilds]   ${g.id} (${g.name}) bot status Err: ${status.error.message}`);
      }
      return {
        id: g.id,
        name: g.name,
        iconUrl: discordGuildIconUrl(g.id, g.icon),
        memberCount: status.isOk() ? status.unwrap().memberCount : null,
        botPresent: status.isOk(),
      };
    }),
  );
  const presentCount = enriched.filter((e) => e.botPresent).length;
  log(
    `[guilds] enriched.length=${enriched.length} botPresent=${presentCount} botMissing=${enriched.length - presentCount}`,
  );

  const reason: EmptyReason | null =
    enriched.length === 0 ? (userGuilds.length === 0 ? "no-user-guilds" : "no-manageable") : null;

  return {
    guilds: enriched,
    botUnavailable: false,
    reason,
    clientId,
  };
};

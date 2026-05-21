import { fail } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import { getConfigPath } from "$lib/server/config-path";
import { parseAutomodPatch } from "$lib/server/dashboard-parsers";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const [channelsResult, rolesResult, configResult] = await Promise.all([
    bridge.getChannels(params.guildId),
    bridge.getRoles(params.guildId),
    bridge.getAdminState(params.guildId),
  ]);

  const channels = channelsResult.isOk() ? channelsResult.unwrap() : [];
  const roles = rolesResult.isOk() ? rolesResult.unwrap() : [];
  const config = configResult.isOk() ? (configResult.unwrap().guild ?? {}) : {};

  return {
    register: "hextech" as const,
    channels,
    roles,
    linkSpam: {
      enabled: Boolean(getConfigPath(config, "automod.linkSpam.enabled")),
      maxLinks: Number(getConfigPath(config, "automod.linkSpam.maxLinks") ?? 4),
      windowSeconds: Number(getConfigPath(config, "automod.linkSpam.windowSeconds") ?? 10),
      reportChannelId:
        (getConfigPath(config, "automod.linkSpam.reportChannelId") as string | null) ?? "",
    },
    mentionSpam: {
      enabled: Boolean(getConfigPath(config, "automod.mentionSpam.enabled")),
      maxMentions: Number(getConfigPath(config, "automod.mentionSpam.maxMentions") ?? 5),
      windowSeconds: Number(getConfigPath(config, "automod.mentionSpam.windowSeconds") ?? 10),
    },
    perUserSlow: {
      enabled: Boolean(getConfigPath(config, "automod.perUserSlow.enabled")),
      rules: Array.isArray(getConfigPath(config, "automod.perUserSlow.rules"))
        ? getConfigPath(config, "automod.perUserSlow.rules")
        : [],
    },
  };
};

export const actions: Actions = {
  saveLinkSpam: async ({ params, request, locals }) => {
    const data = await request.formData();
    const patch = parseAutomodPatch(data, "linkSpam");
    if (!patch.ok) return fail(400, { section: "linkSpam", error: patch.error });
    const result = await getBridge().saveAutomod(
      params.guildId,
      patch.value,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { section: "linkSpam", error: result.error.message });
    return { success: true, section: "linkSpam" };
  },
  saveMentionSpam: async ({ params, request, locals }) => {
    const data = await request.formData();
    const patch = parseAutomodPatch(data, "mentionSpam");
    if (!patch.ok) return fail(400, { section: "mentionSpam", error: patch.error });
    const result = await getBridge().saveAutomod(
      params.guildId,
      patch.value,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { section: "mentionSpam", error: result.error.message });
    return { success: true, section: "mentionSpam" };
  },
  savePerUserSlow: async ({ params, request, locals }) => {
    const data = await request.formData();
    const patch = parseAutomodPatch(data, "perUserSlow");
    if (!patch.ok) return fail(400, { section: "perUserSlow", error: patch.error });
    const result = await getBridge().saveAutomod(
      params.guildId,
      patch.value,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { section: "perUserSlow", error: result.error.message });
    return { success: true, section: "perUserSlow" };
  },
};

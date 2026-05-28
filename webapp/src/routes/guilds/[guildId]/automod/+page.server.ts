import { fail } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import { getConfigPath } from "$lib/server/config-path";
import {
  parseAutomodPatch,
  parseBannedImageTest,
  parseBannedImageUpload,
  text,
} from "$lib/server/dashboard-parsers";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const [channelsResult, rolesResult, configResult] = await Promise.all([
    bridge.getChannels(params.guildId),
    bridge.getRoles(params.guildId),
    bridge.getAdminState(params.guildId),
  ]);
  const bannedImagesResult = await bridge.listBannedImages(params.guildId);

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
    imageDetection: {
      enabled: Boolean(getConfigPath(config, "automod.imageDetection.enabled")),
      reportChannelId:
        (getConfigPath(config, "automod.imageDetection.reportChannelId") as string | null) ?? "",
      tolerance:
        (getConfigPath(config, "automod.imageDetection.tolerance") as string | null) ?? "balanced",
    },
    bannedImages: bannedImagesResult.isOk() ? bannedImagesResult.unwrap() : [],
  };
};

export const actions: Actions = {
  saveLinkSpam: async ({ params, request, locals }) => {
    const data = await request.formData();
    const patch = parseAutomodPatch(data, "linkSpam");
    if (!patch.ok) return fail(400, { section: "linkSpam", field: patch.field, error: patch.error });
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
    if (!patch.ok) return fail(400, { section: "mentionSpam", field: patch.field, error: patch.error });
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
    if (!patch.ok) return fail(400, { section: "perUserSlow", field: patch.field, error: patch.error });
    const result = await getBridge().saveAutomod(
      params.guildId,
      patch.value,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { section: "perUserSlow", error: result.error.message });
    return { success: true, section: "perUserSlow" };
  },
  saveImageDetection: async ({ params, request, locals }) => {
    if (!locals.session)
      return fail(401, { section: "imageDetection", error: "Authentication required" });
    const data = await request.formData();
    const patch = parseAutomodPatch(data, "imageDetection");
    if (!patch.ok) return fail(400, { section: "imageDetection", field: patch.field, error: patch.error });
    const result = await getBridge().saveAutomod(
      params.guildId,
      patch.value,
      locals.session.userId,
    );
    if (result.isErr()) {
      return fail(500, { section: "imageDetection", error: result.error.message });
    }
    return { success: true, section: "imageDetection" };
  },
  addBannedImage: async ({ params, request, locals }) => {
    if (!locals.session)
      return fail(401, { section: "bannedImages", error: "Authentication required" });
    const data = await request.formData();
    const input = await parseBannedImageUpload(data);
    if (!input.ok) return fail(400, { section: "bannedImages", error: input.error });
    const result = await getBridge().addBannedImage(
      params.guildId,
      input.value,
      locals.session.userId,
    );
    if (result.isErr()) return fail(500, { section: "bannedImages", error: result.error.message });
    return { success: true, section: "bannedImages" };
  },
  editBannedImage: async ({ params, request, locals }) => {
    if (!locals.session)
      return fail(401, { section: "bannedImages", error: "Authentication required" });
    const data = await request.formData();
    const id = text(data.get("id"));
    const reason = text(data.get("reason"));
    if (!id || !reason)
      return fail(400, { section: "bannedImages", error: "id and reason required" });
    const result = await getBridge().editBannedImage(
      params.guildId,
      id,
      { reason, label: text(data.get("label")) },
      locals.session.userId,
    );
    if (result.isErr()) return fail(500, { section: "bannedImages", error: result.error.message });
    return { success: true, section: "bannedImages" };
  },
  removeBannedImage: async ({ params, request, locals }) => {
    if (!locals.session)
      return fail(401, { section: "bannedImages", error: "Authentication required" });
    const data = await request.formData();
    const id = text(data.get("id"));
    if (!id) return fail(400, { section: "bannedImages", error: "id required" });
    const result = await getBridge().removeBannedImage(params.guildId, id, locals.session.userId);
    if (result.isErr()) return fail(500, { section: "bannedImages", error: result.error.message });
    return { success: true, section: "bannedImages" };
  },
  testBannedImage: async ({ params, request }) => {
    const data = await request.formData();
    const input = await parseBannedImageTest(data);
    if (!input.ok) return fail(400, { section: "imageTest", error: input.error });
    const result = await getBridge().testBannedImage(params.guildId, input.value);
    if (result.isErr()) return fail(500, { section: "imageTest", error: result.error.message });
    return { success: true, section: "imageTest", imageTest: result.unwrap() };
  },
};

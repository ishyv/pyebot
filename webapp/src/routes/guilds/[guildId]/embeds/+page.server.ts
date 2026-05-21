import { fail, redirect } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import { blankEmbedDraft } from "$lib/server/embed-parsers";
import type { Actions, PageServerLoad } from "./$types";

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const [embedsResult, channelsResult] = await Promise.all([
    bridge.listEmbeds(params.guildId),
    bridge.getChannels(params.guildId),
  ]);
  return {
    embeds: embedsResult.isOk() ? embedsResult.unwrap() : [],
    channels: channelsResult.isOk() ? channelsResult.unwrap() : [],
  };
};

export const actions: Actions = {
  create: async ({ params, request, locals }) => {
    const data = await request.formData();
    const name = normalizeName(String(data.get("name") ?? ""));
    if (!name) return fail(400, { error: "name must contain letters, numbers, - or _." });

    const existing = await getBridge().getEmbed(params.guildId, name);
    if (existing.isOk() && existing.unwrap() !== null) {
      return fail(409, { error: `an embed named ${name} already exists.` });
    }
    const created = await getBridge().saveEmbed(
      params.guildId,
      name,
      blankEmbedDraft(),
      locals.session?.userId,
    );
    if (created.isErr()) return fail(500, { error: created.error.message });
    throw redirect(303, `/guilds/${params.guildId}/embeds/${name}`);
  },

  delete: async ({ params, request, locals }) => {
    const data = await request.formData();
    const name = String(data.get("name") ?? "");
    const result = await getBridge().deleteEmbed(params.guildId, name, locals.session?.userId);
    if (result.isErr()) return fail(500, { error: result.error.message });
    return { success: true };
  },

  send: async ({ params, request, locals }) => {
    const data = await request.formData();
    const name = String(data.get("name") ?? "");
    const result = await getBridge().sendEmbed(params.guildId, name, locals.session?.userId);
    if (result.isErr()) return fail(400, { error: result.error.message });
    return { success: true };
  },
};

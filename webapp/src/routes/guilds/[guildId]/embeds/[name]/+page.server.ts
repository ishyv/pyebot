import { error, fail, redirect } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import { parseEmbedDraft } from "$lib/server/embed-parsers";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const [embedResult, channelsResult] = await Promise.all([
    bridge.getEmbed(params.guildId, params.name),
    bridge.getChannels(params.guildId),
  ]);

  if (embedResult.isErr()) throw error(503, "could not load embed.");
  const embed = embedResult.unwrap();
  if (!embed) throw redirect(303, `/guilds/${params.guildId}/embeds`);

  return {
    embed,
    channels: channelsResult.isOk() ? channelsResult.unwrap() : [],
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals }) => {
    const data = await request.formData();
    const draft = parseEmbedDraft(data);
    if (!draft.ok) return fail(400, { error: draft.error });
    const result = await getBridge().saveEmbed(
      params.guildId,
      params.name,
      draft.value,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(400, { error: result.error.message });
    return { success: true };
  },

  send: async ({ params, locals }) => {
    const result = await getBridge().sendEmbed(params.guildId, params.name, locals.session?.userId);
    if (result.isErr()) return fail(400, { error: result.error.message });
    return { success: true, sent: true };
  },

  delete: async ({ params, locals }) => {
    const result = await getBridge().deleteEmbed(
      params.guildId,
      params.name,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { error: result.error.message });
    throw redirect(303, `/guilds/${params.guildId}/embeds`);
  },
};

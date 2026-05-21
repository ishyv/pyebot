import { fail } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import type { Actions, PageServerLoad } from "./$types";

const CORE_KEYS = [
  "welcome",
  "goodbye",
  "logs",
  "reports",
  "messageLogs",
  "voiceLogs",
  "staff",
] as const;

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, seg) => {
    if (cur === null || typeof cur !== "object") return undefined;
    return (cur as Record<string, unknown>)[seg];
  }, obj);
}

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const [channelsResult, configResult] = await Promise.all([
    bridge.getChannels(params.guildId),
    bridge.getGuildConfig(params.guildId),
  ]);

  const channels = channelsResult.isOk() ? channelsResult.unwrap() : [];
  const config = configResult.isOk() ? configResult.unwrap() : {};

  const values = Object.fromEntries(
    CORE_KEYS.map((key) => {
      const entry = getPath(config, `channels.core.${key}`) as
        | { channelId?: string }
        | null
        | undefined;
      return [key, entry?.channelId ?? ""];
    }),
  );

  return { channels, values };
};

export const actions: Actions = {
  save: async ({ params, request, locals }) => {
    const data = await request.formData();
    const paths: Record<string, unknown> = {};
    for (const key of CORE_KEYS) {
      const raw = data.get(key);
      if (raw === null) continue;
      const id = String(raw).trim();
      paths[`channels.core.${key}`] = id ? { channelId: id } : null;
    }
    const slots = Object.fromEntries(
      Object.entries(paths).map(([path, value]) => [
        path.replace("channels.core.", ""),
        (value as { channelId?: string } | null)?.channelId ?? null,
      ]),
    );
    const result = await getBridge().saveChannels(params.guildId, slots, locals.session?.userId);
    if (result.isErr()) return fail(500, { error: result.error.message });
    return { success: true };
  },
};

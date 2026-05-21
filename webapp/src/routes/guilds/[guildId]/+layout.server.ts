import { error } from "@sveltejs/kit";
import { requireGuildAccess } from "$lib/server/access";
import { getBridge } from "$lib/server/bridge";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ params, locals }) => {
  await requireGuildAccess(locals.session, params.guildId);

  const status = await getBridge().getGuildStatus(params.guildId);
  if (status.isErr()) throw error(404, "Guild status unavailable.");

  return {
    guild: status.unwrap(),
  };
};

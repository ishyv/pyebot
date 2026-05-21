import { error, json } from "@sveltejs/kit";
import { requireGuildAccess } from "$lib/server/access";
import { getBridge } from "$lib/server/bridge";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  await requireGuildAccess(locals.session, params.guildId);
  const result = await getBridge().getRoles(params.guildId);
  if (result.isErr()) throw error(503, result.error.message);
  return json({ roles: result.unwrap() });
};

import { requireRpgEditor } from "$lib/server/rpg-access";
import type { PageServerLoad } from "./$types";

/**
 * Gate the /rpg page on `BOT_OWNER_IDS`. All /api/rpg/** endpoints repeat
 * this check; the page-level check is what prevents the UI from rendering
 * for unauthorized users in the first place.
 */
export const load: PageServerLoad = async ({ locals }) => {
  requireRpgEditor(locals.session);
  return { register: "arcane" as const };
};

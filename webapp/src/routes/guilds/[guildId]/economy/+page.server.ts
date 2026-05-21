import { fail } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import {
  parseDailyEconomyPatch,
  parseTaxEconomyPatch,
  parseWorkEconomyPatch,
} from "$lib/server/dashboard-parsers";
import { readEconomyPageValues } from "$lib/server/economy-config";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const configResult = await bridge.getAdminState(params.guildId);
  return readEconomyPageValues(configResult.isOk() ? configResult.unwrap() : {});
};

export const actions: Actions = {
  saveDaily: async ({ params, request, locals }) => {
    const data = await request.formData();
    const patch = parseDailyEconomyPatch(data);
    if (!patch.ok) return fail(400, { section: "daily", error: patch.error });
    const result = await getBridge().saveEconomy(
      params.guildId,
      { daily: patch.value },
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { section: "daily", error: result.error.message });
    return { success: true, section: "daily" };
  },
  saveWork: async ({ params, request, locals }) => {
    const data = await request.formData();
    const patch = parseWorkEconomyPatch(data);
    if (!patch.ok) return fail(400, { section: "work", error: patch.error });
    const result = await getBridge().saveEconomy(
      params.guildId,
      { work: patch.value },
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { section: "work", error: result.error.message });
    return { success: true, section: "work" };
  },
  saveTax: async ({ params, request, locals }) => {
    const data = await request.formData();
    const patch = parseTaxEconomyPatch(data);
    if (!patch.ok) return fail(400, { section: "tax", error: patch.error });
    const result = await getBridge().saveEconomyTax(
      params.guildId,
      patch.value,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { section: "tax", error: result.error.message });
    return { success: true, section: "tax" };
  },
};

import { fail } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const features = await getBridge().listFeatures(params.guildId);
  return {
    features: features.isOk() ? features.unwrap() : [],
  };
};

export const actions: Actions = {
  toggle: async ({ params, request, locals }) => {
    const data = await request.formData();
    const featureId = String(data.get("featureId") ?? "");
    const enabled = data.get("enabled") === "true";
    if (!featureId) return fail(400, { error: "featureId required" });
    const result = await getBridge().toggleFeature(
      params.guildId,
      featureId,
      enabled,
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { error: result.error.message });
    return { success: true, featureId };
  },
};

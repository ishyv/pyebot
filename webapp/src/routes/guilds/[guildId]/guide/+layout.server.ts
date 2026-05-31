import { getBridge } from "$lib/server/bridge";
import type { LayoutServerLoad } from "./$types";

/**
 * Loads per-feature enabled state for this server so topic pages can show a live
 * badge. Reuses the existing listFeatures bridge method (no graph). On failure we
 * return an empty map: topics simply render without an enabled badge.
 */
export const load: LayoutServerLoad = async ({ params }) => {
  const features = await getBridge().listFeatures(params.guildId);
  const featureEnabled: Record<string, boolean> = {};
  if (features.isOk()) {
    for (const f of features.unwrap()) featureEnabled[f.id] = f.enabled;
  }
  return { featureEnabled };
};

import { getGuildFeatures, resolveFeatureEnabled } from "@/components/guild-features";
import { listFeatureCatalog } from "@/core/featureCatalog";
import { ErrResult, OkResult } from "@/core/result";
import { toggleFeatureSetting } from "@/features/adminPanels/configMutations";
import type { BotBridge, FeatureSummary } from "../bridge-types";
import type { BridgeEmit } from "./shared";

/** Creates feature toggle bridge methods backed by the GuildFeatures component. */
export function createFeatureBridge(
  emit: BridgeEmit,
): Pick<BotBridge, "listFeatures" | "toggleFeature"> {
  return {
    async listFeatures(guildId) {
      const featureState = await getGuildFeatures(guildId);
      if (featureState.isErr()) return ErrResult(featureState.error);
      const features = listFeatureCatalog();
      const summaries: FeatureSummary[] = features.map((feature) => ({
        id: feature.id,
        hasConfig: feature.config !== undefined,
        enabled: resolveFeatureEnabled(feature, featureState.unwrap().overrides),
      }));
      return OkResult(summaries);
    },

    async toggleFeature(guildId, featureId, enabled, actorId) {
      const feature = listFeatureCatalog().find((entry) => entry.id === featureId);
      if (!feature) return ErrResult(new Error(`Unknown feature: ${featureId}`));
      const result = await toggleFeatureSetting(guildId, featureId, enabled);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: `Feature ${featureId} ${enabled ? "enabled" : "disabled"}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },
  };
}

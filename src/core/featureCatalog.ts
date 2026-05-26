import {
  buildCapabilityGraph,
  type FeatureConfigRegistry,
  getCapabilityFeatureConfig,
  getCapabilityLoadedFeatures,
  installCapabilityGraph,
} from "@/core/capabilityGraph";
import type { FeatureConfigDefinition } from "@/core/featureConfig";
import type { FeatureDescriptor, LoadedFeature } from "@/framework/types";

export type { FeatureConfigRegistry } from "@/core/capabilityGraph";

/**
 * Dashboard-facing summary of a loaded framework feature.
 * Config is optional because the active framework descriptor does not require
 * dashboard-editable settings for every feature.
 */
export interface FeatureCatalogEntry extends FeatureDescriptor {
  readonly config?: FeatureConfigDefinition;
}

/**
 * Snapshots the active framework features for web/admin surfaces.
 * Runtime dispatch still uses the loader result directly; this installs the
 * canonical graph that those read-only surfaces query.
 */
export function setFeatureCatalog(
  features: readonly LoadedFeature[],
  configs: FeatureConfigRegistry = {},
): void {
  installCapabilityGraph(buildCapabilityGraph({ features, configs }));
}

/** Returns loaded feature metadata in framework loader order. */
export function listFeatureCatalog(): readonly FeatureCatalogEntry[] {
  return getCapabilityLoadedFeatures().map((feature) => {
    const descriptor: FeatureDescriptor = feature.descriptor;
    const config = getCapabilityFeatureConfig(descriptor.id);
    return config ? { ...descriptor, config } : descriptor;
  });
}

/** Returns the boot-loaded feature objects for runtime-derived read-only projections. */
export function listLoadedFeatures(): readonly LoadedFeature[] {
  return getCapabilityLoadedFeatures();
}

/** Returns only features that declare dashboard-editable config metadata. */
export function listConfigurableFeatures(): readonly FeatureCatalogEntry[] {
  return listFeatureCatalog().filter((feature) => feature.config !== undefined);
}

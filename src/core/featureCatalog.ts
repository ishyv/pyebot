import type { FeatureConfigDefinition } from "@/core/featureConfig";
import type { FeatureDescriptor, LoadedFeature } from "@/framework/types";

/**
 * Dashboard-facing summary of a loaded framework feature.
 * Config is optional because the active framework descriptor does not require
 * dashboard-editable settings for every feature.
 */
export interface FeatureCatalogEntry extends FeatureDescriptor {
  readonly config?: FeatureConfigDefinition;
}

/**
 * Dashboard-only config metadata keyed by feature id.
 * This stays outside `FeatureDescriptor` so runtime feature manifests remain
 * pure loader metadata instead of becoming a dumping ground for admin UI state.
 */
export type FeatureConfigRegistry = Readonly<Record<string, FeatureConfigDefinition | undefined>>;

let loadedFeatures: readonly FeatureCatalogEntry[] = [];
let loadedRuntimeFeatures: readonly LoadedFeature[] = [];

/**
 * Snapshots the active framework features for web/admin surfaces.
 * Runtime dispatch still uses the loader result directly; this exists only so
 * read-only UI code does not import framework bootstrap internals.
 */
export function setFeatureCatalog(
  features: readonly LoadedFeature[],
  configs: FeatureConfigRegistry = {},
): void {
  loadedRuntimeFeatures = features;
  loadedFeatures = features.map((feature) => {
    const config = configs[feature.descriptor.id];
    return config ? { ...feature.descriptor, config } : feature.descriptor;
  });
}

/** Returns loaded feature metadata in framework loader order. */
export function listFeatureCatalog(): readonly FeatureCatalogEntry[] {
  return loadedFeatures;
}

/** Returns the boot-loaded feature objects for runtime-derived read-only projections. */
export function listLoadedFeatures(): readonly LoadedFeature[] {
  return loadedRuntimeFeatures;
}

/** Returns only features that declare dashboard-editable config metadata. */
export function listConfigurableFeatures(): readonly FeatureCatalogEntry[] {
  return loadedFeatures.filter((feature) => feature.config !== undefined);
}

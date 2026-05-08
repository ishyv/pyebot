import type { RuntimeFeature } from "@/core/feature";

let loadedFeatures: readonly RuntimeFeature[] = [];

export function setFeatureCatalog(features: readonly RuntimeFeature[]): void {
  loadedFeatures = [...features];
}

export function listFeatureCatalog(): readonly RuntimeFeature[] {
  return loadedFeatures;
}

export function listConfigurableFeatures(): readonly RuntimeFeature[] {
  return loadedFeatures.filter((feature) => feature.config !== undefined);
}

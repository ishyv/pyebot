import type { FeatureModule } from "@/core/feature";

let loadedFeatures: readonly FeatureModule[] = [];

export function setFeatureCatalog(features: readonly FeatureModule[]): void {
  loadedFeatures = [...features];
}

export function listFeatureCatalog(): readonly FeatureModule[] {
  return loadedFeatures;
}

export function listConfigurableFeatures(): readonly FeatureModule[] {
  return loadedFeatures.filter((feature) => feature.config !== undefined);
}

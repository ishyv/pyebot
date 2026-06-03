import type { FeatureConfigRegistry } from "@/core/featureCatalog";
import { countingFeatureConfig } from "./counting/config";
import { exampleFeatureConfig } from "./example/config";

/**
 * Dashboard-editable config metadata for loaded features.
 * Feature descriptors stay loader-only; this map is the explicit bridge from
 * feature-owned config declarations to admin/webapp surfaces.
 */
export const FEATURE_CONFIGS = {
  counting: countingFeatureConfig,
  example: exampleFeatureConfig,
} satisfies FeatureConfigRegistry;

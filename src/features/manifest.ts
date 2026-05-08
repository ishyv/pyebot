/**
 * Feature manifest.
 *
 * This is the single file you edit when adding or removing a feature.
 * Each entry is a lazy import factory — features load in order, errors are isolated.
 *
 * Why lazy imports instead of static:
 * - A static `import * from "@/features/economy"` at module load time would mean
 *   a broken feature crashes bootstrap before even reaching the feature list.
 * - With factories, each feature loads independently and a failure names the culprit.
 * - TypeScript still validates the import path and the returned type at build time.
 */

import type { FeatureModule } from "@/core/feature";

export const featureFactories: Array<() => Promise<FeatureModule>> = [
  () => import("@/features/adminPanels/index").then((m) => m.default),
  () => import("@/features/economy/index").then((m) => m.default),
  () => import("@/features/rpg/index").then((m) => m.default),
  () => import("@/features/moderation/index").then((m) => m.default),
  () => import("@/features/tickets/index").then((m) => m.default),
  () => import("@/features/autoroles/index").then((m) => m.default),
  () => import("@/features/ai/index").then((m) => m.default),
  () => import("@/features/offers/index").then((m) => m.default),
  () => import("@/features/automod/index").then((m) => m.default),
  () => import("@/features/counting/index").then((m) => m.default),
];

/**
 * `defineFeature()` — the identity helper every feature's `index.ts` uses
 * to export its manifest.
 *
 * The reason this exists is the same reason `component()` exists: it pins
 * the type of the returned literal so the loader can rely on a stable shape
 * (`FeatureDescriptor`) without runtime validation. The function does
 * literally nothing at runtime — it returns its input unchanged.
 *
 * Why not just `export default { ... } as FeatureDescriptor`?
 * Because then a typo (`description: "..."` → `descriptionn`) would be
 * accepted by the `as` cast. Passing through a typed function forces
 * TypeScript to check the shape at the call site.
 *
 * Example:
 *
 *   // src/features/economy/index.ts
 *   export default defineFeature({
 *     id: "economy",
 *     name: "Economy",
 *     description: "Currency, markets, quests",
 *     defaultEnabled: true,
 *   });
 *
 * Discovery: the loader scans `src/features/<id>/index.ts` for a default
 * export of `FeatureDescriptor` shape. The `id` field MUST match the
 * folder name — the loader asserts this so that `id` is a single source of
 * truth.
 */

import type { FeatureDescriptor } from "./types";

type NoExtraKeys<T, Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>;

/** Define a feature manifest. See file header for details. */
export function defineFeature<const T extends FeatureDescriptor>(
  descriptor: NoExtraKeys<T, FeatureDescriptor>,
): T {
  return descriptor;
}

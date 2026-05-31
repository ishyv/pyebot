/**
 * Live material catalog.
 *
 * The object identity is stable, but dashboard reloads can replace its
 * contents in-place. Treat `MaterialId` as a narrowed runtime string.
 *
 * Materials are referenced by inventory, gathering locations, crafting recipes,
 * and processing recipes. Snapshot validation in `runtime.ts` owns referential
 * integrity; domain code assumes parsed IDs are safe.
 */

import { type RuntimeMaterialDef, runtimeMaterials } from "./runtime";

export type MaterialSource = RuntimeMaterialDef["source"];
export type MaterialDef = RuntimeMaterialDef;

export const MATERIALS = runtimeMaterials;

/** Runtime material ID after validation at a Discord, recipe, or dashboard boundary. */
export type MaterialId = string;

/** Untrusted-string boundary helper for inventory keys and recipe lookups. */
export function parseMaterialId(value: string | null | undefined): MaterialId | null {
  return value && value in MATERIALS ? (value as MaterialId) : null;
}

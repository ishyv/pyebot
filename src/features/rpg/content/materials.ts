/**
 * Static material catalog.
 *
 * Authoritative compile-time source. `MaterialId = keyof typeof MATERIALS`
 * gives downstream code typed IDs without round-tripping through Zod.
 * Materials live in user inventories as `inventory.<MaterialId>` numeric quantities.
 */

export type MaterialSource = "mine" | "forest" | "processing";

export interface MaterialDef {
  readonly name: string;
  readonly tier: 1 | 2 | 3 | 4;
  readonly source: MaterialSource;
}

export const MATERIALS = {
  // Raw mining drops
  stone:        { name: "Stone",        tier: 1, source: "mine" },
  copper_ore:   { name: "Copper Ore",   tier: 2, source: "mine" },
  iron_ore:     { name: "Iron Ore",     tier: 3, source: "mine" },
  silver_ore:   { name: "Silver Ore",   tier: 4, source: "mine" },
  // Raw forest drops
  oak_wood:     { name: "Oak Wood",     tier: 1, source: "forest" },
  spruce_wood:  { name: "Spruce Wood",  tier: 2, source: "forest" },
  palm_wood:    { name: "Palm Wood",    tier: 3, source: "forest" },
  pine_wood:    { name: "Pine Wood",    tier: 4, source: "forest" },
  // Processed
  stone_block:  { name: "Stone Block",  tier: 1, source: "processing" },
  copper_ingot: { name: "Copper Ingot", tier: 2, source: "processing" },
  iron_ingot:   { name: "Iron Ingot",   tier: 3, source: "processing" },
  silver_ingot: { name: "Silver Ingot", tier: 4, source: "processing" },
  oak_plank:    { name: "Oak Plank",    tier: 1, source: "processing" },
  spruce_plank: { name: "Spruce Plank", tier: 2, source: "processing" },
  palm_plank:   { name: "Palm Plank",   tier: 3, source: "processing" },
  pine_plank:   { name: "Pine Plank",   tier: 4, source: "processing" },
} as const satisfies Record<string, MaterialDef>;

export type MaterialId = keyof typeof MATERIALS;

/** Untrusted-string boundary helper for inventory keys and recipe lookups. */
export function parseMaterialId(value: string | null | undefined): MaterialId | null {
  return value && value in MATERIALS ? (value as MaterialId) : null;
}

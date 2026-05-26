/**
 * Production-line catalog for the tycoon ("Guild Automated Works") feature.
 *
 * Each line is a three-stage chain — extractor → refinery → assembler — themed
 * on the RPG's existing materials. `rawMaterialId`/`refinedMaterialId` reference
 * real material ids (see rpg content) so "stockpile" mode can deposit them into
 * the player's stash; `finishedGood` is an abstract, tycoon-only good that is
 * auto-sold for scrip in "sell" mode and never enters inventory.
 *
 * Catalog is compile-time (`as const satisfies`) like the RPG content catalogs,
 * so ids are derived. `parseLineId` narrows untrusted Discord input at the edge.
 */

export type StageKind = "extractor" | "refinery" | "assembler";

export interface StageDef {
  readonly name: string;
  /** Units/hour at level 1, before milestone multipliers. */
  readonly baseRate: number;
  /** Coins to upgrade from level 1 → 2. */
  readonly baseUpgradeCost: number;
  /** Geometric growth of upgrade cost per level. */
  readonly upgradeCostMult: number;
}

export interface LineDef {
  readonly name: string;
  readonly tier: 1 | 2 | 3 | 4;
  /** Coins to charter the line. */
  readonly charterCost: number;
  /** Real material id produced by the extractor / consumed by the refinery. */
  readonly rawMaterialId: string;
  /** Real material id the refinery produces — deposited to stash in stockpile mode. */
  readonly refinedMaterialId: string;
  /** Abstract assembler output, auto-sold for scrip in sell mode. */
  readonly finishedGood: { readonly name: string; readonly scripValue: number };
  readonly stages: Readonly<Record<StageKind, StageDef>>;
  /** Levels between output doublings. */
  readonly milestoneEvery: number;
  /** Offline storage cap, expressed in hours of production (Idle-Miner warehouse model). */
  readonly capHours: number;
  /** Coins for the automation module (removes the offline cap). */
  readonly automationCost: number;
}

export const LINES = {
  lumber_mill: {
    name: "Lumber Mill",
    tier: 1,
    charterCost: 500,
    rawMaterialId: "oak_wood",
    refinedMaterialId: "oak_plank",
    finishedGood: { name: "Oak Furniture", scripValue: 3 },
    stages: {
      extractor: { name: "Logging Rig", baseRate: 30, baseUpgradeCost: 120, upgradeCostMult: 1.18 },
      refinery: { name: "Sawmill", baseRate: 24, baseUpgradeCost: 150, upgradeCostMult: 1.2 },
      assembler: { name: "Carpentry", baseRate: 20, baseUpgradeCost: 200, upgradeCostMult: 1.22 },
    },
    milestoneEvery: 25,
    capHours: 8,
    automationCost: 2500,
  },
  copper_works: {
    name: "Copper Works",
    tier: 2,
    charterCost: 2000,
    rawMaterialId: "copper_ore",
    refinedMaterialId: "copper_ingot",
    finishedGood: { name: "Copper Components", scripValue: 7 },
    stages: {
      extractor: {
        name: "Copper Extractor",
        baseRate: 26,
        baseUpgradeCost: 300,
        upgradeCostMult: 1.2,
      },
      refinery: { name: "Smelter", baseRate: 22, baseUpgradeCost: 360, upgradeCostMult: 1.21 },
      assembler: { name: "Foundry", baseRate: 18, baseUpgradeCost: 460, upgradeCostMult: 1.23 },
    },
    milestoneEvery: 25,
    capHours: 8,
    automationCost: 9000,
  },
  iron_works: {
    name: "Iron Works",
    tier: 3,
    charterCost: 8000,
    rawMaterialId: "iron_ore",
    refinedMaterialId: "iron_ingot",
    finishedGood: { name: "Iron Fittings", scripValue: 15 },
    stages: {
      extractor: {
        name: "Iron Extractor",
        baseRate: 22,
        baseUpgradeCost: 900,
        upgradeCostMult: 1.22,
      },
      refinery: {
        name: "Blast Smelter",
        baseRate: 19,
        baseUpgradeCost: 1100,
        upgradeCostMult: 1.23,
      },
      assembler: { name: "Toolworks", baseRate: 16, baseUpgradeCost: 1400, upgradeCostMult: 1.25 },
    },
    milestoneEvery: 20,
    capHours: 10,
    automationCost: 30000,
  },
  silver_forge: {
    name: "Silver Forge",
    tier: 4,
    charterCost: 30000,
    rawMaterialId: "silver_ore",
    refinedMaterialId: "silver_ingot",
    finishedGood: { name: "Silver Filigree", scripValue: 34 },
    stages: {
      extractor: {
        name: "Silver Extractor",
        baseRate: 18,
        baseUpgradeCost: 2600,
        upgradeCostMult: 1.24,
      },
      refinery: {
        name: "Refining Furnace",
        baseRate: 15,
        baseUpgradeCost: 3200,
        upgradeCostMult: 1.25,
      },
      assembler: {
        name: "Silversmith",
        baseRate: 13,
        baseUpgradeCost: 4200,
        upgradeCostMult: 1.27,
      },
    },
    milestoneEvery: 20,
    capHours: 12,
    automationCost: 110000,
  },
} as const satisfies Record<string, LineDef>;

export type LineId = keyof typeof LINES;

/** Untrusted-string boundary helper. Narrows arbitrary input to a known LineId. */
export function parseLineId(value: string | null | undefined): LineId | null {
  return value && value in LINES ? (value as LineId) : null;
}

export const STAGE_ORDER: readonly StageKind[] = ["extractor", "refinery", "assembler"];

/** Stages that actually run in a given mode (assembler is idle while stockpiling). */
export function activeStagesForMode(mode: "sell" | "stockpile"): readonly StageKind[] {
  return mode === "sell" ? STAGE_ORDER : ["extractor", "refinery"];
}

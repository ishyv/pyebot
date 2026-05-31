/**
 * Mutable RPG content snapshot used by the embedded dashboard.
 *
 * Static TypeScript content is the boot seed/fallback. Dashboard saves persist
 * a Mongo snapshot and replace these maps at runtime after validation. Consumers
 * import the live maps through the existing content modules, so command code
 * does not need to know whether content came from source or Mongo.
 *
 * Invariants:
 * - The exported map objects keep stable identity for imports.
 * - Snapshot replacement mutates those objects in place after validation.
 * - IDs are runtime strings narrowed at command/handler boundaries with
 *   `parseXId` helpers; do not derive `keyof typeof` IDs from these maps.
 *
 * Gotcha: `DEFAULT_CONTENT_PACK` currently seeds items only. Locations, tools,
 * and recipes below are the gameplay fallback until the content registry and
 * dashboard model are deliberately reconciled.
 */

import { DEFAULT_CONTENT_PACK } from "@/content/packs/default";
import { type ItemDef, ItemDefSchema } from "@/content/schemas";
import { getDb } from "@/core/db";
import { ErrResult, OkResult, type Result } from "@/core/result";
import type { GatherAction } from "./actions";

export type RuntimeMaterialSource = "mine" | "forest" | "processing";

export interface RuntimeMaterialDef {
  readonly name: string;
  readonly tier: 1 | 2 | 3 | 4;
  readonly source: RuntimeMaterialSource;
}

export interface RuntimeLocationDef {
  readonly id: string;
  readonly name: string;
  readonly action: GatherAction;
  readonly requiredTier: 1 | 2 | 3 | 4;
  readonly materials: readonly string[];
}

export interface RuntimeToolDef {
  readonly name: string;
  readonly kind: "pickaxe" | "axe";
  readonly tier: 1 | 2 | 3 | 4;
  readonly startingDurability: number;
}

export interface RuntimeCraftingRecipeDef {
  readonly requires: Readonly<Record<string, number>>;
}

export interface RuntimeProcessingRecipeDef {
  readonly output: string;
  readonly materialsPerBatch: number;
  readonly outputPerBatch: number;
  readonly tier: 1 | 2 | 3 | 4;
}

export interface RpgContentSnapshot {
  readonly items: Readonly<Record<string, ItemDef>>;
  readonly materials: Readonly<Record<string, RuntimeMaterialDef>>;
  readonly locations: Readonly<Record<string, RuntimeLocationDef>>;
  readonly tools: Readonly<Record<string, RuntimeToolDef>>;
  readonly craftingRecipes: Readonly<Record<string, RuntimeCraftingRecipeDef>>;
  readonly processingRecipes: Readonly<Record<string, RuntimeProcessingRecipeDef>>;
}

const CONTENT_DOC_ID = "active";
type RpgContentDocument = { _id: string; snapshot?: RpgContentSnapshot; updatedAt?: Date };

function defaultSnapshot(): RpgContentSnapshot {
  return {
    items: { ...DEFAULT_CONTENT_PACK.items },
    materials: {
      stone: { name: "Stone", tier: 1, source: "mine" },
      copper_ore: { name: "Copper Ore", tier: 2, source: "mine" },
      iron_ore: { name: "Iron Ore", tier: 3, source: "mine" },
      silver_ore: { name: "Silver Ore", tier: 4, source: "mine" },
      oak_wood: { name: "Oak Wood", tier: 1, source: "forest" },
      spruce_wood: { name: "Spruce Wood", tier: 2, source: "forest" },
      palm_wood: { name: "Palm Wood", tier: 3, source: "forest" },
      pine_wood: { name: "Pine Wood", tier: 4, source: "forest" },
      stone_block: { name: "Stone Block", tier: 1, source: "processing" },
      copper_ingot: { name: "Copper Ingot", tier: 2, source: "processing" },
      iron_ingot: { name: "Iron Ingot", tier: 3, source: "processing" },
      silver_ingot: { name: "Silver Ingot", tier: 4, source: "processing" },
      oak_plank: { name: "Oak Plank", tier: 1, source: "processing" },
      spruce_plank: { name: "Spruce Plank", tier: 2, source: "processing" },
      palm_plank: { name: "Palm Plank", tier: 3, source: "processing" },
      pine_plank: { name: "Pine Plank", tier: 4, source: "processing" },
    },
    locations: {
      stone_mine: {
        id: "stone_mine",
        name: "Stone Mine",
        action: "mine",
        requiredTier: 1,
        materials: ["stone"],
      },
      copper_mine: {
        id: "copper_mine",
        name: "Copper Mine",
        action: "mine",
        requiredTier: 2,
        materials: ["copper_ore"],
      },
      iron_mine: {
        id: "iron_mine",
        name: "Iron Mine",
        action: "mine",
        requiredTier: 3,
        materials: ["iron_ore"],
      },
      silver_mine: {
        id: "silver_mine",
        name: "Silver Mine",
        action: "mine",
        requiredTier: 4,
        materials: ["silver_ore"],
      },
      oak_forest: {
        id: "oak_forest",
        name: "Oak Forest",
        action: "forest",
        requiredTier: 1,
        materials: ["oak_wood"],
      },
      spruce_forest: {
        id: "spruce_forest",
        name: "Spruce Forest",
        action: "forest",
        requiredTier: 2,
        materials: ["spruce_wood"],
      },
      palm_forest: {
        id: "palm_forest",
        name: "Palm Forest",
        action: "forest",
        requiredTier: 3,
        materials: ["palm_wood"],
      },
      pine_forest: {
        id: "pine_forest",
        name: "Pine Forest",
        action: "forest",
        requiredTier: 4,
        materials: ["pine_wood"],
      },
    },
    tools: {
      starter_pickaxe: {
        name: "Starter Pickaxe",
        kind: "pickaxe",
        tier: 1,
        startingDurability: 50,
      },
      starter_axe: { name: "Starter Axe", kind: "axe", tier: 1, startingDurability: 50 },
      stone_pickaxe: { name: "Stone Pickaxe", kind: "pickaxe", tier: 2, startingDurability: 100 },
      stone_axe: { name: "Stone Axe", kind: "axe", tier: 2, startingDurability: 100 },
      copper_pickaxe: {
        name: "Copper Pickaxe",
        kind: "pickaxe",
        tier: 3,
        startingDurability: 100,
      },
      copper_axe: { name: "Copper Axe", kind: "axe", tier: 3, startingDurability: 100 },
      iron_pickaxe: { name: "Iron Pickaxe", kind: "pickaxe", tier: 4, startingDurability: 100 },
      iron_axe: { name: "Iron Axe", kind: "axe", tier: 4, startingDurability: 100 },
    },
    craftingRecipes: {
      stone_pickaxe: { requires: { stone: 3 } },
      copper_pickaxe: { requires: { copper_ingot: 3 } },
      iron_pickaxe: { requires: { iron_ingot: 3 } },
      stone_axe: { requires: { oak_plank: 3 } },
      copper_axe: { requires: { copper_ingot: 3 } },
      iron_axe: { requires: { iron_ingot: 3 } },
    },
    processingRecipes: {
      stone: { output: "stone_block", materialsPerBatch: 2, outputPerBatch: 1, tier: 1 },
      copper_ore: { output: "copper_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 2 },
      iron_ore: { output: "iron_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 3 },
      silver_ore: { output: "silver_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 4 },
      oak_wood: { output: "oak_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 1 },
      spruce_wood: { output: "spruce_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 2 },
      palm_wood: { output: "palm_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 3 },
      pine_wood: { output: "pine_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 4 },
    },
  };
}

export const runtimeItems: Record<string, ItemDef> = {};
export const runtimeMaterials: Record<string, RuntimeMaterialDef> = {};
export const runtimeLocations: Record<string, RuntimeLocationDef> = {};
export const runtimeTools: Record<string, RuntimeToolDef> = {};
export const runtimeCraftingRecipes: Record<string, RuntimeCraftingRecipeDef> = {};
export const runtimeProcessingRecipes: Record<string, RuntimeProcessingRecipeDef> = {};

function assignRecord<T>(target: Record<string, T>, next: Readonly<Record<string, T>>): void {
  // WHY: consumers import the map object once. Reassigning the export would
  // strand existing imports on stale content, so reload mutates in place.
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, next);
}

function applySnapshot(next: RpgContentSnapshot): void {
  assignRecord(runtimeItems, next.items);
  assignRecord(runtimeMaterials, next.materials);
  assignRecord(runtimeLocations, next.locations);
  assignRecord(runtimeTools, next.tools);
  assignRecord(runtimeCraftingRecipes, next.craftingRecipes);
  assignRecord(runtimeProcessingRecipes, next.processingRecipes);
}

function cloneSnapshot(snapshot: RpgContentSnapshot): RpgContentSnapshot {
  return {
    items: structuredClone(snapshot.items),
    materials: structuredClone(snapshot.materials),
    locations: structuredClone(snapshot.locations),
    tools: structuredClone(snapshot.tools),
    craftingRecipes: structuredClone(snapshot.craftingRecipes),
    processingRecipes: structuredClone(snapshot.processingRecipes),
  };
}

function activeSnapshot(): RpgContentSnapshot {
  return {
    items: runtimeItems,
    materials: runtimeMaterials,
    locations: runtimeLocations,
    tools: runtimeTools,
    craftingRecipes: runtimeCraftingRecipes,
    processingRecipes: runtimeProcessingRecipes,
  };
}

function validateSnapshot(snapshot: RpgContentSnapshot): Error | null {
  // WHY: item schemas are reused from the source content layer because item
  // shape crosses inventory, market, and dashboard boundaries.
  for (const [id, item] of Object.entries(snapshot.items)) {
    const parsed = ItemDefSchema.safeParse(item);
    if (!parsed.success) {
      return new Error(`Item ${id} is invalid: ${parsed.error.issues[0]?.message ?? "invalid"}.`);
    }
    if (parsed.data.id !== id) return new Error(`Item key ${id} must match its id.`);
  }

  for (const [id, location] of Object.entries(snapshot.locations)) {
    if (id !== location.id) return new Error(`Location key ${id} must match its id.`);
    for (const materialId of location.materials) {
      if (!snapshot.materials[materialId]) {
        return new Error(`Location ${id} references unknown material ${materialId}.`);
      }
    }
  }

  for (const [inputId, recipe] of Object.entries(snapshot.processingRecipes)) {
    if (!snapshot.materials[inputId]) {
      return new Error(`Processing recipe ${inputId} has an unknown input material.`);
    }
    if (!snapshot.materials[recipe.output]) {
      return new Error(`Processing recipe ${inputId} outputs unknown material ${recipe.output}.`);
    }
  }

  for (const [recipeId, recipe] of Object.entries(snapshot.craftingRecipes)) {
    if (!snapshot.tools[recipeId]) {
      return new Error(`Crafting recipe ${recipeId} does not produce a known tool.`);
    }
    for (const materialId of Object.keys(recipe.requires)) {
      if (!snapshot.materials[materialId]) {
        return new Error(`Crafting recipe ${recipeId} requires unknown material ${materialId}.`);
      }
    }
  }

  return null;
}

applySnapshot(defaultSnapshot());

/** Returns a detached copy of the currently active RPG content. */
export function getRpgContentSnapshot(): RpgContentSnapshot {
  return cloneSnapshot(activeSnapshot());
}

/**
 * Atomically replaces active RPG content after validation.
 * Failed validation leaves the previous snapshot untouched.
 *
 * Intended for tests and dashboard bridge verification. Runtime callers should
 * use `saveRpgContent` so Mongo and the live maps stay aligned.
 */
export function replaceRpgContentForTest(next: RpgContentSnapshot): Result<void, Error> {
  const error = validateSnapshot(next);
  if (error) return ErrResult(error);
  applySnapshot(cloneSnapshot(next));
  return OkResult(undefined);
}

/** Restores the boot fallback content. Intended for tests and failed reload recovery. */
export function resetRpgContentForTest(): void {
  applySnapshot(defaultSnapshot());
}

/**
 * Load persisted dashboard-authored RPG content from Mongo.
 *
 * Side effects: replaces the live maps in place. Missing Mongo state falls back
 * to source defaults; malformed Mongo state returns `Err` and leaves callers to
 * decide whether to keep the current process state or reset.
 */
export async function reloadRpgContent(): Promise<Result<RpgContentSnapshot, Error>> {
  try {
    const db = await getDb();
    const doc = await db
      .collection<RpgContentDocument>("rpg_content")
      .findOne({ _id: CONTENT_DOC_ID });
    if (!doc) {
      const snapshot = defaultSnapshot();
      applySnapshot(snapshot);
      return OkResult(getRpgContentSnapshot());
    }
    const snapshot = (doc as { snapshot?: RpgContentSnapshot }).snapshot;
    if (!snapshot)
      return ErrResult(new Error("Persisted RPG content document is missing snapshot."));
    const error = validateSnapshot(snapshot);
    if (error) return ErrResult(error);
    applySnapshot(cloneSnapshot(snapshot));
    return OkResult(getRpgContentSnapshot());
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Validate, persist, and activate dashboard-authored RPG content.
 *
 * The write happens before `applySnapshot()`. If Mongo fails, the in-memory bot
 * continues using the previous snapshot rather than accepting content that will
 * disappear on restart.
 */
export async function saveRpgContent(
  next: RpgContentSnapshot,
): Promise<Result<RpgContentSnapshot, Error>> {
  const error = validateSnapshot(next);
  if (error) return ErrResult(error);

  try {
    const snapshot = cloneSnapshot(next);
    const db = await getDb();
    await db.collection<RpgContentDocument>("rpg_content").updateOne(
      { _id: CONTENT_DOC_ID },
      {
        $set: {
          snapshot,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    applySnapshot(snapshot);
    return OkResult(getRpgContentSnapshot());
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

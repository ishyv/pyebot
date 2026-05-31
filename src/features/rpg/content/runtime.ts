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
 * Gotcha: `DEFAULT_RPG_CONTENT` is only the source fallback. A valid Mongo
 * `rpg_content.active` snapshot replaces it after boot validation.
 */

import { type ItemDef, ItemDefSchema } from "@/content/schemas";
import { getDb } from "@/core/db";
import { ErrResult, OkResult, type Result } from "@/core/result";
import type { GatherAction } from "./actions";
import { DEFAULT_RPG_CONTENT } from "./default-content";

export { DEFAULT_RPG_CONTENT } from "./default-content";

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
  return structuredClone(DEFAULT_RPG_CONTENT);
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

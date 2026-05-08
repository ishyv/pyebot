/**
 * Content Registry.
 *
 * Purpose: Provide runtime access to loaded RPG content (items, recipes, drop tables,
 * locations) with efficient indexing and lookup operations.
 *
 * Context: Initialized at startup via loadContentRegistry(); cached for the process lifetime.
 *
 * Dependencies:
 * - Content loader for file I/O and validation
 * - Content schemas for type definitions
 *
 * Invariants:
 * - Registry is immutable after creation; no hot-reload in production.
 * - All lookups return null on miss (no exceptions for missing content).
 * - Drop table queries are pre-indexed by action:tier for O(1) access.
 * - Processing recipes enforce unique input items (throws on duplicate).
 *
 * Gotchas:
 * - Cached globally; test utilities must call resetContentRegistryForTests().
 * - getDrops() filters are AND-combined (profession AND location AND toolTier).
 *
 * RISK: Duplicate processing recipe inputs throw at load time (startup failure).
 * RISK: Registry singleton prevents multi-tenant content packs.
 * ALT: Consider read-through caching for large content sets.
 */

// NOTE: The Maps in RuntimeContentRegistry are immutable data indexes built from loaded
// content files. They are NOT session/cooldown state — that lives in src/core/state.ts.

import {
  loadContentPacks,
  type LoadedContentPacks,
  type SourcedDropTableDef,
  type SourcedItemDef,
  type SourcedLocationDef,
  type SourcedRecipeDef,
} from "@/content/loader";
import {
  validateLoadedContent,
  ContentValidationError,
} from "@/content/validation";
import type { GatherAction, Profession } from "@/content/schemas";

export { ContentValidationError };

export interface DropQueryOptions {
  /** Only include drop tables matching this profession. Tables with no profession (global) are always included. */
  readonly profession?: Profession;
  /** Only include drop tables matching this location. Tables with no locationId (global) are always included. */
  readonly locationId?: string;
  /** Exclude entries with minToolTier greater than this value. */
  readonly toolTier?: number;
}

export type ContentDropEntry = {
  readonly tableId: string;
  readonly action: GatherAction;
  readonly profession?: Profession;
  readonly tier: number;
  readonly locationId?: string;
  readonly itemId: string;
  readonly chance: number;
  readonly weight: number;
  readonly minQty: number;
  readonly maxQty: number;
  readonly minToolTier?: number;
  readonly __source: { file: string; jsonPath: string };
};

export interface ContentRegistry {
  readonly loadedFrom: string;
  getItem(id: string): SourcedItemDef | null;
  listItems(): readonly SourcedItemDef[];
  getRecipe(id: string): SourcedRecipeDef | null;
  listRecipes(): readonly SourcedRecipeDef[];
  listRecipesByType(type: "crafting" | "processing"): readonly SourcedRecipeDef[];
  findProcessingRecipeByInput(itemId: string): SourcedRecipeDef | null;
  /**
   * Return drop entries for the given action and tier, filtered by options.
   * Drop tables with no locationId are "global" — they match any location query.
   * Drop tables with no profession are similarly global.
   */
  getDrops(
    action: GatherAction,
    tier: number,
    options?: DropQueryOptions,
  ): readonly ContentDropEntry[];
  getLocationById(id: string): SourcedLocationDef | null;
  getLocations(profession?: Profession): readonly SourcedLocationDef[];
}

class RuntimeContentRegistry implements ContentRegistry {
  readonly loadedFrom: string;
  private readonly itemsById: Map<string, SourcedItemDef>;
  private readonly recipesById: Map<string, SourcedRecipeDef>;
  private readonly locationsById: Map<string, SourcedLocationDef>;
  private readonly locationsSorted: readonly SourcedLocationDef[];
  private readonly dropTablesByActionTier: Map<string, readonly SourcedDropTableDef[]>;
  private readonly processingByInputItemId: Map<string, SourcedRecipeDef>;

  constructor(packs: LoadedContentPacks) {
    this.loadedFrom = packs.packDir;

    this.itemsById = new Map(packs.items.map((item) => [item.id, item]));
    this.recipesById = new Map(packs.recipes.map((recipe) => [recipe.id, recipe]));
    this.locationsById = new Map(
      packs.locations.map((location) => [location.id, location]),
    );
    this.locationsSorted = packs.locations.slice().sort((a, b) =>
      a.requiredTier - b.requiredTier,
    );

    const grouped = new Map<string, SourcedDropTableDef[]>();
    for (const dropTable of packs.dropTables) {
      const key = this.buildActionTierKey(dropTable.action, dropTable.tier);
      const current = grouped.get(key) ?? [];
      current.push(dropTable);
      grouped.set(key, current);
    }
    this.dropTablesByActionTier = grouped;

    this.processingByInputItemId = this.indexProcessingRecipes(packs.recipes);
  }

  getItem(id: string): SourcedItemDef | null {
    return this.itemsById.get(id) ?? null;
  }

  listItems(): readonly SourcedItemDef[] {
    return Array.from(this.itemsById.values());
  }

  getRecipe(id: string): SourcedRecipeDef | null {
    return this.recipesById.get(id) ?? null;
  }

  listRecipes(): readonly SourcedRecipeDef[] {
    return Array.from(this.recipesById.values());
  }

  listRecipesByType(type: "crafting" | "processing"): readonly SourcedRecipeDef[] {
    return this.listRecipes().filter((recipe) => recipe.type === type);
  }

  findProcessingRecipeByInput(itemId: string): SourcedRecipeDef | null {
    return this.processingByInputItemId.get(itemId) ?? null;
  }

  getDrops(
    action: GatherAction,
    tier: number,
    options?: DropQueryOptions,
  ): readonly ContentDropEntry[] {
    const key = this.buildActionTierKey(action, tier);
    const tables = this.dropTablesByActionTier.get(key) ?? [];
    const result: ContentDropEntry[] = [];

    for (const table of tables) {
      if (options?.profession && table.profession && table.profession !== options.profession) {
        continue;
      }

      if (options?.locationId && table.locationId && table.locationId !== options.locationId) {
        continue;
      }

      table.entries.forEach((entry, index) => {
        if (
          options?.toolTier !== undefined &&
          entry.minToolTier !== undefined &&
          options.toolTier < entry.minToolTier
        ) {
          return;
        }

        result.push({
          tableId: table.id,
          action: table.action,
          profession: table.profession,
          tier: table.tier,
          locationId: table.locationId,
          itemId: entry.itemId,
          chance: entry.chance,
          weight: entry.weight,
          minQty: entry.minQty,
          maxQty: entry.maxQty ?? entry.minQty,
          minToolTier: entry.minToolTier,
          __source: {
            file: table.__source.file,
            jsonPath: `${table.__source.jsonPath}.entries[${index}]`,
          },
        });
      });
    }

    return result;
  }

  getLocationById(id: string): SourcedLocationDef | null {
    return this.locationsById.get(id) ?? null;
  }

  getLocations(profession?: Profession): readonly SourcedLocationDef[] {
    if (!profession) {
      return this.locationsSorted;
    }
    return this.locationsSorted.filter((location) => location.profession === profession);
  }

  private buildActionTierKey(action: GatherAction, tier: number): string {
    return `${action}:${tier}`;
  }

  private indexProcessingRecipes(
    recipes: readonly SourcedRecipeDef[],
  ): Map<string, SourcedRecipeDef> {
    const index = new Map<string, SourcedRecipeDef>();
    const issues: string[] = [];

    for (const recipe of recipes) {
      if (recipe.type !== "processing") {
        continue;
      }

      const input = recipe.itemInputs[0];
      if (!input) {
        continue;
      }

      const existing = index.get(input.itemId);
      if (existing) {
        issues.push(
          `Duplicate processing recipe input '${input.itemId}' in ${existing.__source.file} ${existing.__source.jsonPath} and ${recipe.__source.file} ${recipe.__source.jsonPath}`,
        );
        continue;
      }

      index.set(input.itemId, recipe);
    }

    if (issues.length > 0) {
      throw new ContentValidationError("Invalid processing recipe index", issues);
    }

    return index;
  }
}

let cachedRegistry: ContentRegistry | null = null;
let cachedDir: string | null = null;

export async function loadContentRegistry(
  packDir?: string,
  options?: { forceReload?: boolean },
): Promise<ContentRegistry> {
  const cacheKey = packDir ?? "typed:default";
  if (
    !options?.forceReload &&
    cachedRegistry &&
    cachedDir === cacheKey
  ) {
    return cachedRegistry;
  }

  const packs = await loadContentPacks(packDir);
  validateLoadedContent(packs);
  const registry = new RuntimeContentRegistry(packs);
  cachedRegistry = registry;
  cachedDir = cacheKey;
  return registry;
}

export async function loadContentRegistryOrThrow(): Promise<ContentRegistry> {
  return loadContentRegistry(undefined, { forceReload: true });
}

export function getContentRegistry(): ContentRegistry | null {
  return cachedRegistry;
}

export function resetContentRegistryForTests(): void {
  cachedRegistry = null;
  cachedDir = null;
}

/**
 * Build a ContentRegistry from an in-memory LoadedContentPacks object.
 * Useful for testing without file I/O.
 */
export function buildRegistryFromPacks(packs: LoadedContentPacks): ContentRegistry {
  validateLoadedContent(packs);
  return new RuntimeContentRegistry(packs);
}

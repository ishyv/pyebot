/**
 * Cross-record validation for loaded content packs.
 *
 * content/schemas.ts validates the shape of individual records. This module
 * validates relationships between records after a pack is loaded: duplicate
 * IDs, unknown item/location/drop-table references, and recipe constraints.
 * Keeping these checks here lets typed built-in packs and legacy JSON5 packs
 * share the same runtime safety net.
 */
const DEFAULT_CURRENCY_IDS = new Set(["coins", "rep"]);

interface SourceMeta {
  readonly file: string;
  readonly jsonPath: string;
}

interface SourcedEntry {
  readonly id: string;
  readonly __source: SourceMeta;
}

interface LoadedContentPacks {
  readonly packDir: string;
  readonly items: readonly SourcedEntry[];
  readonly recipes: readonly (SourcedEntry & {
    readonly type: string;
    readonly craftingMethod?: string;
    readonly itemInputs: readonly { readonly itemId: string }[];
    readonly itemOutputs: readonly { readonly itemId: string }[];
    readonly currencyInput?: { readonly currencyId: string };
    readonly guildFee?: { readonly currencyId: string };
  })[];
  readonly dropTables: readonly (SourcedEntry & {
    readonly action: string;
    readonly locationId?: string;
    readonly entries: readonly { readonly itemId: string }[];
  })[];
  readonly locations: readonly (SourcedEntry & {
    readonly action: string;
    readonly dropTableId?: string;
    readonly materials: readonly string[];
  })[];
}

export interface ValidationContext {
  /** Known item IDs from outside content packs (e.g. hardcoded inventory items). Defaults to empty set. */
  readonly extraItemIds?: ReadonlySet<string>;
  /** Known currency IDs. Defaults to ["coins", "rep"]. */
  readonly knownCurrencyIds?: ReadonlySet<string>;
}

export class ContentValidationError extends Error {
  constructor(
    message: string,
    public readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = "ContentValidationError";
  }
}

function sourceLabel(entry: { __source: { file: string; jsonPath: string } }): string {
  return `${entry.__source.file} ${entry.__source.jsonPath}`;
}

function checkDuplicateIds<T extends { id: string; __source: { file: string; jsonPath: string } }>(
  entries: readonly T[],
  entityName: string,
): string[] {
  const issues: string[] = [];
  const byId = new Map<string, T>();

  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }

    issues.push(
      `Duplicate ${entityName} id '${entry.id}' in ${sourceLabel(existing)} and ${sourceLabel(entry)}`,
    );
  }

  return issues;
}

function buildKnownItemIds(content: LoadedContentPacks, extraItemIds?: ReadonlySet<string>): Set<string> {
  const ids = new Set<string>(extraItemIds ?? []);
  for (const item of content.items) {
    ids.add(item.id);
  }
  return ids;
}

export function validateLoadedContent(content: LoadedContentPacks, ctx: ValidationContext = {}): void {
  const issues: string[] = [];

  issues.push(...checkDuplicateIds(content.items, "item"));
  issues.push(...checkDuplicateIds(content.recipes, "recipe"));
  issues.push(...checkDuplicateIds(content.dropTables, "drop table"));
  issues.push(...checkDuplicateIds(content.locations, "location"));

  const knownItemIds = buildKnownItemIds(content, ctx.extraItemIds);
  const knownCurrencyIds = ctx.knownCurrencyIds ?? DEFAULT_CURRENCY_IDS;
  const knownDropTableIds = new Set(content.dropTables.map((table) => table.id));
  const knownLocationIds = new Set(content.locations.map((location) => location.id));
  const dropTablesById = new Map(content.dropTables.map((table) => [table.id, table]));

  for (const recipe of content.recipes) {
    if (recipe.type !== "crafting" && recipe.craftingMethod) {
      issues.push(
        `${sourceLabel(recipe)} $.craftingMethod is only valid for crafting recipes`,
      );
    }

    recipe.itemInputs.forEach((input, inputIndex) => {
      if (!knownItemIds.has(input.itemId)) {
        issues.push(
          `${sourceLabel(recipe)} $.itemInputs[${inputIndex}].itemId references unknown item '${input.itemId}'`,
        );
      }
    });

    recipe.itemOutputs.forEach((output, outputIndex) => {
      if (!knownItemIds.has(output.itemId)) {
        issues.push(
          `${sourceLabel(recipe)} $.itemOutputs[${outputIndex}].itemId references unknown item '${output.itemId}'`,
        );
      }
    });

    if (
      recipe.currencyInput &&
      !knownCurrencyIds.has(recipe.currencyInput.currencyId)
    ) {
      issues.push(
        `${sourceLabel(recipe)} $.currencyInput.currencyId references unknown currency '${recipe.currencyInput.currencyId}'`,
      );
    }

    if (recipe.guildFee && !knownCurrencyIds.has(recipe.guildFee.currencyId)) {
      issues.push(
        `${sourceLabel(recipe)} $.guildFee.currencyId references unknown currency '${recipe.guildFee.currencyId}'`,
      );
    }
  }

  for (const dropTable of content.dropTables) {
    if (dropTable.locationId && !knownLocationIds.has(dropTable.locationId)) {
      issues.push(
        `${sourceLabel(dropTable)} $.locationId references unknown location '${dropTable.locationId}'`,
      );
    }

    dropTable.entries.forEach((entry, entryIndex) => {
      if (!knownItemIds.has(entry.itemId)) {
        issues.push(
          `${sourceLabel(dropTable)} $.entries[${entryIndex}].itemId references unknown item '${entry.itemId}'`,
        );
      }
    });
  }

  for (const location of content.locations) {
    if (location.dropTableId && !knownDropTableIds.has(location.dropTableId)) {
      issues.push(
        `${sourceLabel(location)} $.dropTableId references unknown drop table '${location.dropTableId}'`,
      );
    }

    const dropTable = location.dropTableId ? dropTablesById.get(location.dropTableId) : null;
    if (dropTable && dropTable.action !== location.action) {
      issues.push(
        `${sourceLabel(location)} $.dropTableId references drop table '${dropTable.id}' with action '${dropTable.action}', expected '${location.action}'`,
      );
    }

    location.materials.forEach((materialId, materialIndex) => {
      if (!knownItemIds.has(materialId)) {
        issues.push(
          `${sourceLabel(location)} $.materials[${materialIndex}] references unknown item '${materialId}'`,
        );
      }
    });
  }

  if (issues.length > 0) {
    throw new ContentValidationError(
      "Content validation failed",
      issues,
    );
  }
}

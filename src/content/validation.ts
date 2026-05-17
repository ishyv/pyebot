import type { DropTableDef, ItemDef, LocationDef, RecipeDef } from "./schemas";

const DEFAULT_CURRENCY_IDS = new Set(["coins", "rep"]);

export interface SourceMeta {
  readonly file: string;
  readonly jsonPath: string;
}

export type Sourced<T> = T & { readonly __source: SourceMeta };

export interface LoadedContent {
  readonly packDir: string;
  readonly items: readonly Sourced<ItemDef>[];
  readonly recipes: readonly Sourced<RecipeDef>[];
  readonly dropTables: readonly Sourced<DropTableDef>[];
  readonly locations: readonly Sourced<LocationDef>[];
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

function buildKnownItemIds(
  content: LoadedContent,
  extraItemIds?: ReadonlySet<string>,
): Set<string> {
  const ids = new Set<string>(extraItemIds ?? []);
  for (const item of content.items) {
    ids.add(item.id);
  }
  return ids;
}

export function validateLoadedContent(content: LoadedContent, ctx: ValidationContext = {}): void {
  const issues: string[] = [];

  issues.push(...checkDuplicateIds(content.items, "item"));
  issues.push(...checkDuplicateIds(content.recipes, "recipe"));
  issues.push(...checkDuplicateIds(content.dropTables, "drop table"));
  issues.push(...checkDuplicateIds(content.locations, "location"));

  const knownItemIds = buildKnownItemIds(content, ctx.extraItemIds);
  const knownCurrencyIds = ctx.knownCurrencyIds ?? DEFAULT_CURRENCY_IDS;
  const knownDropTableIds = new Set(content.dropTables.map((table) => table.id));
  const knownLocationIds = new Set(content.locations.map((location) => location.id));

  for (const recipe of content.recipes) {
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

    if (recipe.currencyInput && !knownCurrencyIds.has(recipe.currencyInput.currencyId)) {
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

    location.materials.forEach((materialId, materialIndex) => {
      if (!knownItemIds.has(materialId)) {
        issues.push(
          `${sourceLabel(location)} $.materials[${materialIndex}] references unknown item '${materialId}'`,
        );
      }
    });
  }

  if (issues.length > 0) {
    throw new ContentValidationError("Content validation failed", issues);
  }
}

/**
 * Compile-time authoring helpers for built-in typed content packs.
 *
 * These helpers intentionally duplicate some runtime schema concepts so the
 * default pack can fail during TypeScript checking when object keys, nested
 * IDs, or intra-pack references drift. Runtime validation still runs at startup
 * for cross-record invariants that are clearer outside the type system.
 */

import type {
  LoadedContentPacks,
  SourcedDropTableDef,
  SourcedItemDef,
  SourcedLocationDef,
  SourcedRecipeDef,
} from "@/content/loader";
import type { DropTableDef, ItemDef, LocationDef, RecipeDef } from "@/content/schemas";

type StringKeyOf<T> = Extract<keyof T, string>;

type ItemRef<ItemId extends string> = {
  readonly itemId: ItemId;
  readonly quantity: number;
};

type AuthorRecipe<ItemId extends string> = Omit<RecipeDef, "itemInputs" | "itemOutputs"> & {
  readonly itemInputs: readonly ItemRef<ItemId>[];
  readonly itemOutputs: readonly ItemRef<ItemId>[];
};

type AuthorDropEntry<ItemId extends string> = Omit<DropTableDef["entries"][number], "itemId"> & {
  readonly itemId: ItemId;
};

type AuthorDropTable<ItemId extends string, LocationId extends string> = Omit<
  DropTableDef,
  "entries" | "locationId"
> & {
  readonly locationId?: LocationId;
  readonly entries: readonly AuthorDropEntry<ItemId>[];
};

type AuthorLocation<ItemId extends string> = Omit<LocationDef, "materials"> & {
  readonly materials?: readonly ItemId[];
};

type ItemMap<Items> = {
  readonly [K in StringKeyOf<Items>]: ItemDef & { readonly id: K };
};

type RecipeMap<ItemId extends string, Recipes> = {
  readonly [K in StringKeyOf<Recipes>]: AuthorRecipe<ItemId> & { readonly id: K };
};

type LocationMap<ItemId extends string, Locations> = {
  readonly [K in StringKeyOf<Locations>]: AuthorLocation<ItemId> & { readonly id: K };
};

type DropTableMap<ItemId extends string, LocationId extends string, DropTables> = {
  readonly [K in StringKeyOf<DropTables>]: AuthorDropTable<ItemId, LocationId> & { readonly id: K };
};

export interface DefinedContentPack<
  Items extends Record<string, ItemDef>,
  Recipes extends Record<string, AuthorRecipe<StringKeyOf<Items>>>,
  Locations extends Record<string, AuthorLocation<StringKeyOf<Items>>>,
  DropTables extends Record<string, AuthorDropTable<StringKeyOf<Items>, StringKeyOf<Locations>>>,
> {
  readonly id: string;
  readonly items: Items;
  readonly recipes: Recipes;
  readonly locations: Locations;
  readonly dropTables: DropTables;
}

/**
 * Define item content with compile-time key/id matching.
 *
 * The object key is the public content ID. The nested `id` must be the same
 * literal, or TypeScript will reject the definition before runtime.
 */
export function defineItems<const Items extends Record<string, ItemDef>>(
  items: Items & ItemMap<Items>,
): Items {
  return items;
}

export function defineRecipes<
  ItemId extends string,
  const Recipes extends Record<string, AuthorRecipe<ItemId>>,
>(recipes: Recipes & RecipeMap<ItemId, Recipes>): Recipes {
  return recipes;
}

export function defineLocations<
  ItemId extends string,
  const Locations extends Record<string, AuthorLocation<ItemId>>,
>(locations: Locations & LocationMap<ItemId, Locations>): Locations {
  return locations;
}

export function defineDropTables<
  ItemId extends string,
  LocationId extends string,
  const DropTables extends Record<string, AuthorDropTable<ItemId, LocationId>>,
>(dropTables: DropTables & DropTableMap<ItemId, LocationId, DropTables>): DropTables {
  return dropTables;
}

export function defineContentPack<
  const Items extends Record<string, ItemDef>,
  const Locations extends Record<string, AuthorLocation<StringKeyOf<Items>>>,
  const DropTables extends Record<
    string,
    AuthorDropTable<StringKeyOf<Items>, StringKeyOf<Locations>>
  >,
  const Recipes extends Record<string, AuthorRecipe<StringKeyOf<Items>>>,
>(pack: {
  readonly id: string;
  readonly items: Items & ItemMap<Items>;
  readonly locations: Locations & LocationMap<StringKeyOf<Items>, Locations>;
  readonly dropTables: DropTables &
    DropTableMap<StringKeyOf<Items>, StringKeyOf<Locations>, DropTables>;
  readonly recipes: Recipes & RecipeMap<StringKeyOf<Items>, Recipes>;
}): DefinedContentPack<Items, Recipes, Locations, DropTables> {
  return pack;
}

function sourceFor(packId: string, kind: string, key: string) {
  return {
    file: `typed:${packId}`,
    jsonPath: `$.${kind}.${key}`,
  };
}

export function materializeContentPack(
  pack: DefinedContentPack<
    Record<string, ItemDef>,
    Record<string, AuthorRecipe<string>>,
    Record<string, AuthorLocation<string>>,
    Record<string, AuthorDropTable<string, string>>
  >,
): LoadedContentPacks {
  const items = Object.entries(pack.items).map(([key, item]) => ({
    ...item,
    __source: sourceFor(pack.id, "items", key),
  })) satisfies SourcedItemDef[];

  const recipes = Object.entries(pack.recipes).map(([key, recipe]) => ({
    ...recipe,
    itemInputs: recipe.itemInputs.map((input) => ({ ...input })),
    itemOutputs: recipe.itemOutputs.map((output) => ({ ...output })),
    __source: sourceFor(pack.id, "recipes", key),
  })) satisfies SourcedRecipeDef[];

  const locations = Object.entries(pack.locations).map(([key, location]) => ({
    ...location,
    materials: [...(location.materials ?? [])],
    __source: sourceFor(pack.id, "locations", key),
  })) satisfies SourcedLocationDef[];

  const dropTables = Object.entries(pack.dropTables).map(([key, dropTable]) => ({
    ...dropTable,
    entries: dropTable.entries.map((entry) => ({ ...entry })),
    __source: sourceFor(pack.id, "dropTables", key),
  })) satisfies SourcedDropTableDef[];

  return {
    packDir: `typed:${pack.id}`,
    items,
    recipes,
    locations,
    dropTables,
  };
}

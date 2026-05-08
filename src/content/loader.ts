/**
 * Typed content pack loader.
 *
 * tx is latest-only: runtime content comes from the TypeScript-authored default
 * pack. External JSON/JSON5 pack loading was removed because it duplicated the
 * authoring surface and hid failures until startup.
 */
import { materializeContentPack } from "@/content/authoring";
import { DEFAULT_CONTENT_PACK } from "@/content/packs/default";
import type {
  DropTableDef,
  ItemDef,
  LocationDef,
  RecipeDef,
} from "@/content/schemas";

export interface SourceMeta {
  readonly file: string;
  readonly jsonPath: string;
}

export type Sourced<T> = T & { readonly __source: SourceMeta };
export type SourcedItemDef = Sourced<ItemDef>;
export type SourcedRecipeDef = Sourced<RecipeDef>;
export type SourcedDropTableDef = Sourced<DropTableDef>;
export type SourcedLocationDef = Sourced<LocationDef>;

export interface LoadedContentPacks {
  readonly packDir: string;
  readonly items: readonly SourcedItemDef[];
  readonly recipes: readonly SourcedRecipeDef[];
  readonly dropTables: readonly SourcedDropTableDef[];
  readonly locations: readonly SourcedLocationDef[];
}

export async function loadDefaultContentPacks(): Promise<LoadedContentPacks> {
  return materializeContentPack(DEFAULT_CONTENT_PACK);
}

export async function loadContentPacks(packDir?: string): Promise<LoadedContentPacks> {
  if (packDir) {
    throw new Error("External content pack directories are not supported.");
  }

  return loadDefaultContentPacks();
}

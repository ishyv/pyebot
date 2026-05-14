/**
 * Content Pack Loader.
 *
 * The runtime content source is the typed default pack. External pack folders
 * used to be supported here, but that left root tests depending on files that
 * no longer exist and duplicated the typed authoring framework.
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

export class ContentLoadError extends Error {
  constructor(
    message: string,
    public readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = "ContentLoadError";
  }
}

/**
 * Materialize the built-in typed content pack into the registry loader shape.
 */
export async function loadDefaultContentPacks(): Promise<LoadedContentPacks> {
  return materializeContentPack(DEFAULT_CONTENT_PACK);
}

/**
 * Load content for the bot runtime.
 *
 * External filesystem pack directories are intentionally rejected until the
 * migration story has a single typed boundary again.
 */
export async function loadContentPacks(packDir?: string): Promise<LoadedContentPacks> {
  if (packDir) {
    throw new ContentLoadError("External content pack directories are not supported.", [
      packDir,
    ]);
  }

  return loadDefaultContentPacks();
}

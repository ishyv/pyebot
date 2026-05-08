export {
  loadContentPacks,
  loadDefaultContentPacks,
  loadLegacyContentPacks,
  DEFAULT_CONTENT_PACKS_DIR,
  ContentLoadError,
  type LoadedContentPacks,
  type SourceMeta,
  type Sourced,
  type SourcedItemDef,
  type SourcedRecipeDef,
  type SourcedDropTableDef,
  type SourcedLocationDef,
} from "@/content/loader";

export {
  defineContentPack,
  defineItems,
  defineRecipes,
  defineDropTables,
  defineLocations,
  materializeContentPack,
  type DefinedContentPack,
} from "@/content/authoring";

export {
  validateLoadedContent,
  ContentValidationError,
  type ValidationContext,
} from "@/content/validation";

export {
  loadContentRegistry,
  loadContentRegistryOrThrow,
  getContentRegistry,
  resetContentRegistryForTests,
  buildRegistryFromPacks,
  type ContentRegistry,
  type DropQueryOptions,
  type ContentDropEntry,
} from "@/content/registry";

export {
  CONTENT_SCHEMA_VERSION,
  CONTENT_ID_REGEX,
  ContentIdSchema,
  ProfessionSchema,
  GatherActionSchema,
  TraitSchema,
  ItemCategorySchema,
  ItemRaritySchema,
  ItemSourceSchema,
  MarketCategorySchema,
  MarketMetadataSchema,
  ItemDefSchema,
  RecipeDefSchema,
  DropTableDefSchema,
  LocationDefSchema,
  type Profession,
  type GatherAction,
  type Trait,
  type ItemCategory,
  type ItemRarity,
  type ItemSource,
  type MarketCategory,
  type MarketMetadata,
  type ItemDef,
  type RecipeDef,
  type DropTableDef,
  type LocationDef,
} from "@/content/schemas";

/**
 * Public framework barrel — the surface every feature imports from.
 *
 * Features should NEVER reach into individual framework files. Importing
 * only from `@/framework` keeps refactors safe and the public surface
 * obvious from this one file.
 */

export { bootstrapFramework } from "./bootstrap";
export type { CommandDsl, CommandOptionDsl, DslState, RunContext } from "./command";
export { command } from "./command";
export { component } from "./component";
export type { EntityComponent, EntityKind } from "./entity";
export { defineComponent, entity } from "./entity";
export type { EntityHandle, EntityQuery } from "./entity-handle";
export type { EntityQueryRow } from "./entity-store";
export { defineFeature } from "./feature";
export type {
  ArgsOf,
  ButtonOptions,
  Codec,
  ComponentHandlersFor,
  ComponentKind,
  FeatureHandlers,
  InteractionOf,
  Registration,
  RouteDef,
  RouteEntry,
  RouteInput,
  RouteTable,
} from "./routing";
export {
  defineHandlers,
  defineRoutes,
  int,
  listen,
  on,
  oneOf,
  rest,
  route,
  routeHandlers,
  snowflake,
  str,
} from "./routing";
export type {
  CommandHelp,
  CommandModule,
  Component,
  ComponentRecord,
  Ctx,
  Entity,
  EventConstructor,
  EventHandler,
  FeatureDescriptor,
  LoadedFeature,
  Transaction,
} from "./types";
export { World } from "./world";

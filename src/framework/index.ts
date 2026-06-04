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
export { Handle, Listen, On } from "./decorators";
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
} from "./types";
export { World } from "./world";

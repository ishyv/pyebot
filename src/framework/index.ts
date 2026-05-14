/**
 * Public framework barrel — the surface every feature imports from.
 *
 * Features should NEVER reach into individual framework files. Importing
 * only from `@/framework` keeps refactors safe and the public surface
 * obvious from this one file.
 */

export { component } from "./component";
export { defineFeature } from "./feature";
export { On, Handle, Listen } from "./decorators";
export type {
  Component,
  ComponentRecord,
  Ctx,
  Entity,
  EventConstructor,
  EventHandler,
  FeatureDescriptor,
  CommandModule,
} from "./types";
export { bootstrapFramework } from "./bootstrap";
export { World } from "./world";

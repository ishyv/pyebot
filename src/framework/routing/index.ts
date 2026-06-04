/**
 * Public surface of the typed component-routing system. The framework barrel
 * (`@/framework`) re-exports from here.
 */

export type { Codec } from "./codecs";
export { int, oneOf, rest, snowflake, str } from "./codecs";
export { decodeArgs } from "./decode";
export type {
  ComponentHandlersFor,
  FeatureHandlers,
  Registration,
} from "./registry";
export { defineHandlers, isFeatureHandlers, listen, on, routeHandlers } from "./registry";
export type {
  ArgsOf,
  ButtonOptions,
  ComponentKind,
  InteractionOf,
  RouteDef,
  RouteEntry,
  RouteInput,
  RouteTable,
} from "./routes";
export { defineRoutes, route, routeMeta } from "./routes";

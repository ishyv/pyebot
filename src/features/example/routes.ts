/**
 * Component routes for the example feature — the single typed declaration that
 * drives BOTH sides of a button:
 *
 *   - encode (commands/example.ts): `routes.greet.button({ target })`
 *   - decode (handlers.ts):         `routeHandlers(routes, { greet: (i, args) => ... })`
 *
 * No stringly-typed customId, no hand-written parser. Read alongside
 * `docs/framework-authoring.md`.
 */

import { defineRoutes, snowflake } from "@/framework";

export const routes = defineRoutes("example", {
  // One button route carrying the greeted user's id. `snowflake` validates the
  // segment on encode and decode, so a malformed id is rejected, not mis-routed.
  greet: { target: snowflake },
});

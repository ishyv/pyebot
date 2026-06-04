/**
 * Component routes for tickets. `defineRoutes("tickets", { close: ... })` yields
 * the prefix `tickets:close:` — identical to the previous hand-written constant,
 * so buttons already posted in live ticket channels keep routing.
 */

import { defineRoutes, snowflake } from "@/framework";

export const routes = defineRoutes("tickets", {
  // The close button carries the ticket channel's id.
  close: { channel: snowflake },
});

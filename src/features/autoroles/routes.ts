/**
 * Component routes for autoroles. The self-role toggle button carries the prompt
 * message id and the role id. Route name "toggle" yields the prefix
 * `autorole:toggle:`, identical to the previous constant.
 */

import { defineRoutes, snowflake } from "@/framework";

export const routes = defineRoutes("autorole", {
  toggle: { message: snowflake, role: snowflake },
});

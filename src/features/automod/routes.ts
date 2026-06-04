/**
 * Component routes for automod. The raid alert offers two buttons (lock down /
 * dismiss); neither needs an arg — the handlers act on `interaction.guild`. The
 * old customIds carried the guild id but never read it, so these are zero-arg
 * routes. Route names yield prefixes `automod:raid-lockdown:` / `automod:raid-dismiss:`.
 */

import { defineRoutes } from "@/framework";

export const routes = defineRoutes("automod", {
  "raid-lockdown": {},
  "raid-dismiss": {},
});

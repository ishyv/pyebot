/**
 * Admin panel component handler — a flat registration list. Every admin control
 * shares one catch-all route `c` (see ./routes.ts); the decoded { session,
 * panel, action } args are handed to the panel dispatcher, which routes the
 * per-(panel, action) matrix internally.
 */
import { defineHandlers, routeHandlers } from "@/framework";
import { handlePanelInteraction } from "./panels";
import { panelRoutes } from "./routes";

export default defineHandlers([
  ...routeHandlers(panelRoutes, {
    c: (interaction, { session, panel, action }) =>
      handlePanelInteraction(interaction, session, panel, action),
  }),
]);

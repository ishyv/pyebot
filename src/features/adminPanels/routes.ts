/**
 * Component route for admin panels.
 *
 * Every admin control encodes the same shape — a session key, the active panel,
 * and an action that may itself contain colons (e.g. `override:allow`,
 * `managed:add`). The old `panel:{session}:{panel}:{action}` id put the dynamic
 * session key in the route position, which a static `ns:route` table can't
 * address, so it moves into an argument behind a single catch-all route `c`:
 * `panel:c:{session}:{panel}:{action}`. The greedy `rest` codec captures the
 * action tail, replacing parsePanelCustomId's `actionParts.join(":")`.
 *
 * One route, not ~150: the per-(panel, action) dispatch stays inside
 * handlePanelInteraction — that matrix is data, not routing. Admin panels are
 * in-memory, TTL'd, ephemeral sessions, so the id format need not survive a
 * deploy. The route's declared kind is "button"; at runtime the prefix router is
 * kind-agnostic, so every component/modal subtype still reaches the handler,
 * which re-checks the interaction type as before.
 */

import { defineRoutes, oneOf, rest, route, str } from "@/framework";
import type { PanelId } from "./panelRuntime";

// Kept in sync with PANEL_DEFINITIONS; `satisfies` rejects any id that isn't a
// real PanelId (a typo or removed panel fails to compile).
const PANEL_IDS = [
  "home",
  "channels",
  "features",
  "feature-config",
  "moderation",
  "automod",
  "new-users",
  "roles",
  "autoroles",
  "tickets",
  "ai",
  "offers",
  "economy",
  "reputation",
  "forums",
  "tops",
] as const satisfies readonly PanelId[];

export const panelRoutes = defineRoutes("panel", {
  c: route({ session: str, panel: oneOf(PANEL_IDS), action: rest }, "button"),
});

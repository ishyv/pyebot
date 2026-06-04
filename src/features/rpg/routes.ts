/**
 * Component routes for rpg. Four namespaces, one per interaction surface:
 *
 *   fight       → combat invite accept + per-round move buttons.
 *   equip       → the /equip tool dropdown (a select; the choice is in values).
 *   rpg         → first-run profession picker shown by /rpg-profile.
 *   expedition  → the expedition screen, previously one @Handle sub-router over
 *                 four actions (start / gather / deeper / leave).
 *
 * The `fight_accept:` / `fight_move:` underscore prefixes become `fight:accept:`
 * / `fight:move:` (route ids can't contain underscores). Fight sessions live
 * only in memory, so no persisted button outlives a deploy anyway.
 */

import { defineRoutes, oneOf, route, str } from "@/framework";

export const fightRoutes = defineRoutes("fight", {
  // Invite accept button — carries the in-memory combat session id.
  accept: { session: str },
  // Per-round move button — session id plus the chosen move.
  move: { session: str, move: oneOf(["attack", "block"]) },
});

export const equipRoutes = defineRoutes("equip", {
  // The equipped tool is read from interaction.values, so the route is arg-free.
  select: route({}, "select"),
});

export const onboardRoutes = defineRoutes("rpg", {
  // Profession choice on the welcome card.
  onboard: { profession: oneOf(["miner", "lumber"]) },
});

export const expeditionRoutes = defineRoutes("expedition", {
  start: { biome: oneOf(["mine", "forest"]) },
  gather: { node: str },
  deeper: {},
  leave: {},
});

/**
 * Component routes for tycoon — the whole dashboard, previously one
 * @Handle("tycoon:") handler with a ~10-branch customId switch.
 *
 * The select menus (upgrade / expand / mode) carry their payload in
 * interaction.values, so those routes are arg-free; only the customId is owned
 * here. The "do-*" one-tap buttons encode the target line (and, for upgrade,
 * the stage) — the old `tycoon:do:<action>:…` shared prefix is split per action
 * so each route has a fixed arity the positional decoder can validate.
 *
 * The dashboard is an in-place ephemeral screen, so no button outlives a deploy
 * and these ids never need to stay byte-compatible with the old ones.
 */

import { defineRoutes, oneOf, route, str } from "@/framework";

export const tycoonRoutes = defineRoutes("tycoon", {
  // One-tap "next action" buttons mirroring the Shift Briefing recommendation.
  "do-charter": { line: str },
  "do-automate": { line: str },
  "do-upgrade": { line: str, stage: oneOf(["extractor", "refinery", "assembler"]) },
  // Standalone dashboard buttons.
  collect: {},
  refresh: {},
  exchange: {},
  // Select menus — the choice lives in interaction.values.
  upgrade: route({}, "select"),
  expand: route({}, "select"),
  mode: route({}, "select"),
  // Guild Exchange amount modal.
  "exchange-submit": route({}, "modal"),
});

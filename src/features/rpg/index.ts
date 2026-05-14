/**
 * RPG feature manifest.
 *
 * Surface:
 *   /rpg-profile, /rpg-quest
 *   /gather-mine, /gather-cutdown, /gather-locations
 *   /process, /craft, /equip, /fight
 *
 * Component routes:
 *   - Fight accept buttons, combat move buttons
 *   - Gather location buttons
 *   - Equip select menu
 *   - Onboarding buttons
 *
 * Background work:
 *   - Fight session expiry interval (kicked off once at boot).
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "rpg",
  name: "RPG",
  description: "Gathering, crafting, combat, and equipment.",
  defaultEnabled: true,
});

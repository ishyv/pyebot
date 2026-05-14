/**
 * Offers feature manifest.
 *
 * Surface:
 *   /offer (submission and moderation)
 *
 * Component routes: approve/reject/changes review buttons.
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "offers",
  name: "Offers",
  description: "User-submitted offers with moderator review workflow.",
  defaultEnabled: true,
});

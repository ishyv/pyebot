/**
 * Moderation feature manifest.
 *
 * Surface:
 *   /ban /kick /mute /warn /cases
 *
 * No event listeners or component routes — moderation commands are
 * fire-and-forget. They emit `SanctionIssued` (see events/) for audit
 * features to log.
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "moderation",
  name: "Moderation",
  description: "Ban, kick, mute, warn, and review sanction history.",
  defaultEnabled: true,
});

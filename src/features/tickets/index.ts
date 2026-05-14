/**
 * Tickets feature manifest.
 *
 * Surface:
 *   /ticket open <type> — opens a ticket channel in the configured category
 *   /ticket close       — closes the current ticket channel (staff only)
 *
 * Handlers: button `tickets:close:<channelId>` (rendered in the welcome
 * embed inside each ticket channel).
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "tickets",
  name: "Tickets",
  description: "Create and manage support ticket channels.",
  defaultEnabled: true,
});

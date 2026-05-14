/**
 * Automod feature manifest.
 *
 * Surface:
 *   /automod (admin configuration)
 *
 * Listens to raw `messageCreate` to apply link-spam and domain rules.
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "automod",
  name: "Automod",
  description: "Automatic moderation: link spam, domain whitelist, URL shortener handling.",
  defaultEnabled: true,
});

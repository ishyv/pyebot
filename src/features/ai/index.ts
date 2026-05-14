/**
 * AI feature manifest.
 *
 * Surface:
 *   /ai — configure provider/model
 *
 * Listens to raw `messageCreate` to respond when @mentioned.
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "ai",
  name: "AI Assistant",
  description: "Conversational AI replies when the bot is mentioned.",
  defaultEnabled: false,
});

/**
 * Autoroles feature manifest.
 *
 * Surface:
 *   /autorole create | delete | list | enable | disable
 *
 * Reactions (wired in handlers.ts via defineHandlers):
 *   - onJoin rules apply via on(MemberJoined).
 *   - onReact rules apply via listen("messageReactionAdd"/"messageReactionRemove").
 *   - messageContains rules apply via listen("messageCreate").
 *   - onButton rules apply via the autorole:toggle route.
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "autoroles",
  name: "Autoroles",
  description: "Grant roles automatically based on triggers (join, reaction, button, message).",
  defaultEnabled: true,
});

/**
 * Autoroles feature manifest.
 *
 * Surface:
 *   /autorole create | delete | list | enable | disable
 *
 * Reactions:
 *   - onJoin rules apply via @On(MemberJoined).
 *   - onReact rules apply via @Listen("messageReactionAdd"/"messageReactionRemove").
 *   - messageContains rules apply via @Listen("messageCreate").
 *   - onButton rules apply via @Handle("autorole:toggle:").
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "autoroles",
  name: "Autoroles",
  description: "Grant roles automatically based on triggers (join, reaction, button, message).",
  defaultEnabled: true,
});

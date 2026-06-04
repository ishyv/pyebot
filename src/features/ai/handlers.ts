/**
 * AI feature runtime — a flat registration list.
 *
 *   listen("messageCreate") → respond to @mentions and replies to prior AI messages
 */

import { defineHandlers, listen } from "@/framework";
import { handleAiMessage } from "./handlers/messageCreate";

export default defineHandlers([
  listen("messageCreate", async (message, ctx) => {
    if (!ctx.client.user) return;
    await handleAiMessage(message, ctx.client.user.id);
  }),
]);

/**
 * AI feature component and event handlers.
 *
 * The framework discovers this class at boot and registers:
 *   - @Listen("messageCreate") → respond to @mentions and replies to prior AI messages
 */

import type { Message } from "discord.js";
import { Listen } from "@/framework";
import type { Ctx } from "@/framework/types";
import { handleAiMessage } from "./handlers/messageCreate";

export default class AiHandlers {
  @Listen("messageCreate")
  async onMessage(message: Message, ctx: Ctx): Promise<void> {
    if (!ctx.client.user) return;
    await handleAiMessage(message, ctx.client.user.id);
  }
}

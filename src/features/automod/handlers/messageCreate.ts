/**
 * messageCreate handler — runs automod checks on every message.
 */

import type { Client } from "discord.js";
import { checkMessage } from "@/features/automod/service";
import { checkCrossChannelSpam } from "@/features/automod/crossChannelSpam";
import { checkMentionSpam } from "@/features/automod/mentionSpam";
import { checkSlowmode } from "@/features/automod/slowmode";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:message");

export function register(client: Client): void {
  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      await checkMessage(message);
      await checkCrossChannelSpam(message);
      await checkMentionSpam(message);
      await checkSlowmode(message);
    } catch (err) {
      log.error("Error in automod messageCreate handler", err);
    }
  });
}

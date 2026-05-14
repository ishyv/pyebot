/**
 * messageCreate handler — runs automod checks on every message.
 */

import type { Client } from "discord.js";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import { detectAiClassificationSignals } from "@/features/automod/aiDetector";
import { detectCrossChannelSpam } from "@/features/automod/crossChannelSpam";
import { detectMentionSpam } from "@/features/automod/mentionSpam";
import { detectMessageContentSignals, processAutomodSignals } from "@/features/automod/service";
import { checkSlowmode } from "@/features/automod/slowmode";

const log = createLogger("automod:message");

export function register(client: Client): void {
  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      const guildResult = await getGuild(message.guild.id);
      const guild = guildResult.isOk() ? guildResult.unwrap() : null;
      if (!guild) return;
      const config = guild.automod;
      const signals = [
        ...detectMessageContentSignals(message, config),
        ...detectCrossChannelSpam(message, config),
        ...detectMentionSpam(message, config),
        ...(await detectAiClassificationSignals(message, config)),
      ];
      await processAutomodSignals(message, config, signals);
      await checkSlowmode(message);
    } catch (err) {
      log.error("Error in automod messageCreate handler", err);
    }
  });
}

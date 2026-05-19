import type { Message } from "discord.js";
import { getGuildFeatures, resolveFeatureEnabled } from "@/components/guild-features";
import { resolveConfiguredChannel } from "@/core/featureConfig";
import { createLogger } from "@/core/logger";
import { mongoCountingStateRepository } from "@/db/repositories/counting";
import { getGuild } from "@/db/repositories/guilds";
import { type Ctx, Listen } from "@/framework";
import { countingFeatureConfig } from "./config";
import countingFeature from "./index";
import { processCountingMessage } from "./service";

const log = createLogger("counting:message");

/**
 * Runtime adapter for Discord message events owned by the current feature loader.
 * Counting still gates itself because raw `@Listen` events bypass slash-command
 * feature middleware.
 */
export default class CountingHandlers {
  @Listen("messageCreate")
  async onMessage(message: Message, ctx: Ctx): Promise<void> {
    try {
      if (message.author.bot || !message.guildId) return;

      const guildResult = await getGuild(message.guildId);
      if (guildResult.isErr()) return;

      const guildConfig = guildResult.unwrap();
      if (!guildConfig) return;
      const featureState = await getGuildFeatures(message.guildId);
      if (featureState.isErr()) return;
      if (!resolveFeatureEnabled(countingFeature, featureState.unwrap().overrides)) return;

      const configuredChannel = await resolveConfiguredChannel(
        ctx.client,
        guildConfig,
        countingFeatureConfig,
        "channel",
      );

      await processCountingMessage(
        {
          guildId: message.guildId,
          channelId: message.channelId,
          authorId: message.author.id,
          authorIsBot: message.author.bot,
          content: message.content,
          react: (emoji: string) => message.react(emoji),
        },
        {
          configuredChannelId: configuredChannel?.id ?? null,
          stateRepository: mongoCountingStateRepository,
          logger: log,
        },
      );
    } catch (error) {
      log.error("Error in counting messageCreate handler", error);
    }
  }
}

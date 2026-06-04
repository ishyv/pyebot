import { getGuildFeatures, resolveFeatureEnabled } from "@/components/guild-features";
import { resolveConfiguredChannel } from "@/core/featureConfig";
import { createLogger } from "@/core/logger";
import { mongoCountingStateRepository } from "@/db/repositories/counting";
import { getGuild } from "@/db/repositories/guilds";
import { defineHandlers, listen } from "@/framework";
import { countingFeatureConfig } from "./config";
import countingFeature from "./index";
import { processCountingMessage } from "./service";

const log = createLogger("counting:message");

/**
 * Counting reacts to every message in the configured channel. Raw `listen(...)`
 * events bypass the slash-command feature gate, so this handler self-gates on
 * the feature toggle before doing any work.
 */
export default defineHandlers([
  listen("messageCreate", async (message, ctx) => {
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
  }),
]);

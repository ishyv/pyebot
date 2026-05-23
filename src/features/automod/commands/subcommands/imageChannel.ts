import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod image-channel` report channel updates. */
export async function handleImageChannel(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const channel = interaction.options.getChannel("channel");
  const channelId = channel?.id ?? null;
  const result = await saveAutomodSettings(ctx.guildId, {
    imageDetection: { reportChannelId: channelId },
  });
  if (await handleDbError(result, ctx, "Could not update image report channel.")) return;
  await ctx.respond.send(
    configUpdateMessage(
      "info",
      "Banned-Image Report Channel Updated",
      channelId
        ? `Banned-image reports will be sent to <#${channelId}>.`
        : "Banned-image report channel cleared.",
    ),
  );
}

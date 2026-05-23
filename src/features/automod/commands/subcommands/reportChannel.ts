import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod report-channel` for link-spam report output. */
export async function handleReportChannel(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const channel = interaction.options.getChannel("channel");
  const channelId = channel?.id ?? null;
  const result = await saveAutomodSettings(ctx.guildId, {
    linkSpam: { reportChannelId: channelId },
  });
  if (await handleDbError(result, ctx, "Could not update report channel.")) return;

  await ctx.respond.send(
    configUpdateMessage(
      "info",
      "Report Channel Updated",
      channelId
        ? `Automod reports will be sent to <#${channelId}>.`
        : "Report channel cleared — reports are disabled.",
    ),
  );
}

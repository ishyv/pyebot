import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod crosschannel` cross-channel spam settings. */
export async function handleCrossChannel(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const minChannels = interaction.options.getInteger("min_channels");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const reportChannel = interaction.options.getChannel("report_channel");
  const autoTimeout = interaction.options.getBoolean("auto_timeout");
  const timeoutSeconds = interaction.options.getInteger("timeout_seconds");

  const result = await saveAutomodSettings(ctx.guildId, {
    crossChannelSpam: {
      enabled,
      ...(minChannels !== null ? { minChannels } : {}),
      ...(windowSeconds !== null ? { windowSeconds } : {}),
      ...(reportChannel !== undefined ? { reportChannelId: reportChannel?.id ?? null } : {}),
      ...(autoTimeout !== null ? { autoTimeout } : {}),
      ...(timeoutSeconds !== null ? { timeoutSeconds } : {}),
    },
  });
  if (await handleDbError(result, ctx, "Could not update configuration.")) return;

  const crossChannelLines = [
    minChannels !== null ? `**Min Channels:** ${minChannels}` : null,
    windowSeconds !== null ? `**Window:** ${windowSeconds}s` : null,
    autoTimeout !== null ? `**Auto-timeout:** ${autoTimeout ? "on" : "off"}` : null,
    timeoutSeconds !== null ? `**Timeout Duration:** ${timeoutSeconds}s` : null,
    reportChannel !== undefined
      ? `**Report Channel:** ${reportChannel ? `<#${reportChannel.id}>` : "cleared"}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.respond.send(
    configUpdateMessage(
      enabled ? "ok" : "mute",
      "Cross-Channel Spam Detection Updated",
      `Cross-channel spam detection is now **${enabled ? "enabled" : "disabled"}**.`,
      crossChannelLines || undefined,
      "-# Use /automod status to see full config",
    ),
  );
}

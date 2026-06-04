import type { ChatInputCommandInteraction } from "discord.js";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";
import type { AutomodSubcommandContext } from "./types";

/** Handles `/automod raid` raid-detection settings. */
export async function handleRaid(
  interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const joinsPerMinute = interaction.options.getInteger("joins_per_minute");
  const minAccountAge = interaction.options.getInteger("min_account_age");
  const response = interaction.options.getString("response") as
    | "alert"
    | "lockdown"
    | "quarantine"
    | null;
  const reportChannel = interaction.options.getChannel("report_channel");

  const result = await saveAutomodSettings(ctx.guildId, {
    raidDetection: {
      enabled,
      ...(joinsPerMinute !== null ? { joinsPerMinute } : {}),
      ...(minAccountAge !== null ? { minAccountAgeDays: minAccountAge } : {}),
      ...(response !== null ? { action: response } : {}),
      ...(reportChannel !== undefined ? { reportChannelId: reportChannel?.id ?? null } : {}),
    },
  });
  if (await handleDbError(result, ctx, "Could not update configuration.")) return;

  const raidLines = [
    joinsPerMinute !== null ? `**Join Rate:** ${joinsPerMinute}/min` : null,
    minAccountAge !== null ? `**Min Account Age:** ${minAccountAge}d` : null,
    response !== null ? `**Action:** ${response}` : null,
    reportChannel !== undefined
      ? `**Report Channel:** ${reportChannel ? `<#${reportChannel.id}>` : "cleared"}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.respond.send(
    configUpdateMessage(
      enabled ? "ok" : "mute",
      "Raid Detection Updated",
      `Raid detection is now **${enabled ? "enabled" : "disabled"}**.`,
      raidLines || undefined,
      "-# Use /automod status to see full config",
    ),
  );
}

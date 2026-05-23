import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod slowmode` automatic slowmode settings. */
export async function handleSlowmode(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const messagesPerWindow = interaction.options.getInteger("messages_per_window");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const slowmodeSeconds = interaction.options.getInteger("slowmode_seconds");
  const releaseAfter = interaction.options.getInteger("release_after");

  const result = await saveAutomodSettings(ctx.guildId, {
    slowmode: {
      enabled,
      ...(messagesPerWindow !== null ? { messagesPerWindow } : {}),
      ...(windowSeconds !== null ? { windowSeconds } : {}),
      ...(slowmodeSeconds !== null ? { slowmodeSeconds } : {}),
      ...(releaseAfter !== null ? { releaseAfterSeconds: releaseAfter } : {}),
    },
  });
  if (await handleDbError(result, ctx, "Could not update configuration.")) return;

  const slowmodeLines = [
    messagesPerWindow !== null ? `**Trigger:** ${messagesPerWindow} messages` : null,
    windowSeconds !== null ? `**Window:** ${windowSeconds}s` : null,
    slowmodeSeconds !== null ? `**Slowmode Rate:** ${slowmodeSeconds}s` : null,
    releaseAfter !== null ? `**Release After:** ${releaseAfter}s` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.respond.send(
    configUpdateMessage(
      enabled ? "ok" : "mute",
      "Auto-Slowmode Updated",
      `Automatic slowmode is now **${enabled ? "enabled" : "disabled"}**.`,
      slowmodeLines || undefined,
      "-# Use /automod status to see full config",
    ),
  );
}

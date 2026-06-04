import type { ChatInputCommandInteraction } from "discord.js";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";
import type { AutomodSubcommandContext } from "./types";

/** Handles `/automod mentionspam` mention-spam settings. */
export async function handleMentionSpam(
  interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const maxMentions = interaction.options.getInteger("max_mentions");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const response = interaction.options.getString("response") as
    | "timeout"
    | "delete"
    | "report"
    | null;
  const timeoutSeconds = interaction.options.getInteger("timeout_seconds");

  const result = await saveAutomodSettings(ctx.guildId, {
    mentionSpam: {
      enabled,
      ...(maxMentions !== null ? { maxMentions } : {}),
      ...(windowSeconds !== null ? { windowSeconds } : {}),
      ...(response !== null ? { action: response } : {}),
      ...(timeoutSeconds !== null ? { timeoutSeconds } : {}),
    },
  });
  if (await handleDbError(result, ctx, "Could not update configuration.")) return;

  const mentionLines = [
    maxMentions !== null ? `**Max Mentions:** ${maxMentions}` : null,
    windowSeconds !== null ? `**Window:** ${windowSeconds}s` : null,
    response !== null ? `**Action:** ${response}` : null,
    timeoutSeconds !== null ? `**Timeout Duration:** ${timeoutSeconds}s` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.respond.send(
    configUpdateMessage(
      enabled ? "ok" : "mute",
      "Mention Spam Detection Updated",
      `Mention spam detection is now **${enabled ? "enabled" : "disabled"}**.`,
      mentionLines || undefined,
      "-# Use /automod status to see full config",
    ),
  );
}

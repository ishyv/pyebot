import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod linkspam` without owning the slash-command routing table. */
export async function handleLinkspam(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const maxLinks = interaction.options.getInteger("max_links");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const response = interaction.options.getString("response") as
    | "timeout"
    | "mute"
    | "delete"
    | "report"
    | null;

  const result = await saveAutomodSettings(ctx.guildId, {
    linkSpam: {
      enabled,
      ...(maxLinks !== null ? { maxLinks } : {}),
      ...(windowSeconds !== null ? { windowSeconds } : {}),
      ...(response !== null ? { action: response } : {}),
    },
  });
  if (await handleDbError(result, ctx, "Could not update configuration.")) return;

  const extraLines = [
    maxLinks !== null ? `**Max Links:** ${maxLinks}` : null,
    windowSeconds !== null ? `**Window:** ${windowSeconds}s` : null,
    response !== null ? `**Action:** ${response}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.respond.send(
    configUpdateMessage(
      enabled ? "ok" : "mute",
      "Link Spam Detection Updated",
      `Link spam detection is now **${enabled ? "enabled" : "disabled"}**.`,
      extraLines || undefined,
      "-# Use /automod status to see full config",
    ),
  );
}

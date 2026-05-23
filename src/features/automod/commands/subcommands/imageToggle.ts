import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod image-toggle` for banned-image scanning. */
export async function handleImageToggle(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const result = await saveAutomodSettings(ctx.guildId, {
    imageDetection: { enabled },
  });
  if (await handleDbError(result, ctx, "Could not update image detection.")) return;
  await ctx.respond.send(
    configUpdateMessage(
      enabled ? "ok" : "mute",
      "Banned-Image Detection Updated",
      `Banned-image detection is now **${enabled ? "enabled" : "disabled"}**.`,
    ),
  );
}

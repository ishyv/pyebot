import type { ChatInputCommandInteraction } from "discord.js";
import { displayBannedImageId, removeBannedImage } from "@/features/automod/bannedImages";
import { configUpdateMessage } from "@/ui/v2";
import type { AutomodSubcommandContext } from "./types";

/** Handles `/automod image-remove` banned-image deactivation. */
export async function handleImageRemove(
  interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const id = interaction.options.getString("id", true).trim();
  const removed = await removeBannedImage(ctx.guildId, id, interaction.user.id);
  if (!removed) {
    await ctx.respond.send({ content: `No active banned image \`${id}\` was found.` });
    return;
  }

  await ctx.respond.send(
    configUpdateMessage(
      "warn",
      "Banned Image Removed",
      `\`${displayBannedImageId(removed)}\` is now inactive.`,
    ),
  );
}

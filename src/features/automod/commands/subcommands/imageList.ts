import type { ChatInputCommandInteraction } from "discord.js";
import { displayBannedImageId, listActiveBannedImages } from "@/features/automod/bannedImages";
import type { AutomodSubcommandContext } from "./types";

/** Handles `/automod image-list` with the uniform subcommand handler signature. */
export async function handleImageList(
  _interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const records = await listActiveBannedImages(ctx.entities, ctx.guildId);
  if (records.length === 0) {
    await ctx.respond.send({ content: "No active banned images configured." });
    return;
  }

  const lines = records.slice(0, 20).map((record) => {
    const label = record.label ? ` - ${record.label}` : "";
    return `\`${displayBannedImageId(record)}\`${label} - ${record.reason}`;
  });
  await ctx.respond.send({
    content: [
      `Active banned images: ${records.length}`,
      ...lines,
      records.length > 20 ? `...and ${records.length - 20} more.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

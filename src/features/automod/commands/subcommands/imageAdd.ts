import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import {
  addBannedImage,
  displayBannedImageId,
  fetchImageAttachmentBuffer,
  isSupportedImageAttachment,
} from "@/features/automod/bannedImages";
import { hashImageBuffer, type ImageHashes } from "@/features/automod/imageHash";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod image-add` banned-image fingerprint creation. */
export async function handleImageAdd(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const attachment = interaction.options.getAttachment("image", true);
  const reason = interaction.options.getString("reason", true).trim();
  const label = interaction.options.getString("label")?.trim() || null;

  if (!reason) {
    await ctx.respond.send({ content: "A reason is required." });
    return;
  }
  if (!isSupportedImageAttachment(attachment)) {
    await ctx.respond.send({ content: "That attachment is not a supported image." });
    return;
  }

  const bytes = await fetchImageAttachmentBuffer({
    url: attachment.url,
    size: attachment.size ?? null,
  });
  if (!bytes) {
    await ctx.respond.send({ content: "Could not read that image attachment." });
    return;
  }

  let hashes: ImageHashes;
  try {
    hashes = await hashImageBuffer(bytes);
  } catch {
    await ctx.respond.send({ content: "Could not decode that image." });
    return;
  }

  const record = await addBannedImage({
    guildId: ctx.guildId,
    actorId: interaction.user.id,
    reason,
    label,
    sourceUrl: attachment.url,
    sourceContentType: attachment.contentType,
    sourceFilename: attachment.name,
    hashes,
  });

  await ctx.respond.send(
    configUpdateMessage(
      "ok",
      "Banned Image Added",
      `**ID:** \`${displayBannedImageId(record)}\`\n` +
        `**Reason:** ${reason}\n` +
        `**Label:** ${label ?? "none"}`,
      undefined,
      "-# Enable scanning with /automod image-toggle enable",
    ),
  );
}

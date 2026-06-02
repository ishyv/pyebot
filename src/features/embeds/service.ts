import type { Guild, Message, TextBasedChannel, TextChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { EMBED_MAX_FIELDS } from "./config";
import { runEmbedScript } from "./script-bridge";

/**
 * Build a Discord EmbedBuilder from a stored embed config, optionally applying a script.
 */
export async function buildEmbed(
  config: EmbedConfig,
  channel: { id: string; name: string },
  guild: { id: string; name: string; memberCount: number },
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder();

  if (config.embedTitle !== null) embed.setTitle(config.embedTitle);
  if (config.embedDescription !== null) embed.setDescription(config.embedDescription);
  if (config.embedColor !== null) embed.setColor(config.embedColor);
  if (config.embedUrl !== null) embed.setURL(config.embedUrl);
  if (config.embedThumbnail !== null) embed.setThumbnail(config.embedThumbnail);
  if (config.embedImage !== null) embed.setImage(config.embedImage);

  if (config.embedAuthorName !== null) {
    embed.setAuthor({
      name: config.embedAuthorName,
      iconURL: config.embedAuthorIconUrl ?? undefined,
      url: config.embedAuthorUrl ?? undefined,
    });
  }

  if (config.embedFooterText !== null) {
    embed.setFooter({
      text: config.embedFooterText,
      iconURL: config.embedFooterIconUrl ?? undefined,
    });
  }

  if (config.embedFields.length > 0) {
    embed.addFields(config.embedFields);
  }

  const output = await runEmbedScript(config, channel, guild);
  if (output) {
    if (output.title != null) embed.setTitle(output.title);
    if (output.description != null) embed.setDescription(output.description);
    if (output.color != null) embed.setColor(output.color);
    if (output.footer != null) embed.setFooter({ text: output.footer });

    if (output.fields && output.fields.length > 0) {
      const mergedFields = [...config.embedFields, ...output.fields].slice(0, EMBED_MAX_FIELDS);
      embed.setFields(mergedFields);
    }
  }

  return embed;
}

/**
 * Send the embed to a Discord text channel and return the sent message.
 */
export async function sendEmbed(
  config: EmbedConfig,
  targetChannel: TextBasedChannel,
  guild: Guild,
): Promise<Message> {
  const embed = await buildEmbed(
    config,
    {
      id: targetChannel.id,
      name: "name" in targetChannel ? (targetChannel as { name: string }).name : "channel",
    },
    { id: guild.id, name: guild.name, memberCount: guild.memberCount },
  );
  // PartialGroupDMChannel (part of TextBasedChannel) doesn't expose .send() in discord.js types;
  // in practice callers always pass guild text channels, so we cast via TextChannel.
  return (targetChannel as TextChannel).send({ embeds: [embed] });
}

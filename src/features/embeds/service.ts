import type {
  ChatInputCommandInteraction,
  Guild,
  Message,
  TextBasedChannel,
  TextChannel,
} from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { createLogger } from "@/core/logger";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { EMBED_MAX_FIELDS } from "./config";
import type { ScriptContext } from "./sandbox";
import { runScript } from "./sandbox";

const log = createLogger("embeds:service");

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

  if (config.scriptEnabled && config.script !== null) {
    const ctx: ScriptContext = {
      guild: { id: guild.id, name: guild.name, memberCount: guild.memberCount },
      channel,
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toISOString().slice(11, 16),
    };

    try {
      const output = await runScript(config.script, ctx);

      if (output.title != null) embed.setTitle(output.title);
      if (output.description != null) embed.setDescription(output.description);
      if (output.color != null) embed.setColor(output.color);
      if (output.footer != null) embed.setFooter({ text: output.footer });

      if (output.fields && output.fields.length > 0) {
        const mergedFields = [...config.embedFields, ...output.fields].slice(0, EMBED_MAX_FIELDS);
        embed.setFields(mergedFields);
      }
    } catch (err) {
      log.warn("Script execution failed", err);
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

/**
 * Reply to an interaction with an ephemeral preview of the embed.
 */
export async function renderEmbedPreview(
  config: EmbedConfig,
  interaction: ChatInputCommandInteraction,
  guild: Guild,
): Promise<void> {
  const channel = interaction.channel ?? { id: interaction.channelId ?? "0", name: "channel" };
  const channelCtx = {
    id: channel.id,
    name: "name" in channel ? (channel as { name: string }).name : "channel",
  };
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const embed = await buildEmbed(config, channelCtx, {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
    });
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error("Preview failed", err);
    await interaction.editReply("Failed to build preview.");
  }
}

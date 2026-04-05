/**
 * Ban appeal button handlers.
 *
 * Appeal flow:
 *   1. User clicks "Appeal Ban" in ban DM (customId: "mod:appeal:{guildId}")
 *   2. Bot creates a thread in guild.moderation.appealsChannelId
 *   3. Mods click Approve or Deny in the thread
 *      - Approve: unban + close thread
 *      - Deny: close thread
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Colors,
  ChannelType,
  type ButtonInteraction,
  type TextChannel,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

const log = createLogger("moderation:appeals");

export const APPEAL_PREFIX = "mod:appeal:";
export const APPEAL_APPROVE_PREFIX = "mod:appeal:approve:";
export const APPEAL_DENY_PREFIX = "mod:appeal:deny:";

export const isAppealButton = (id: string): boolean =>
  id.startsWith(APPEAL_PREFIX) && !id.startsWith(APPEAL_APPROVE_PREFIX) && !id.startsWith(APPEAL_DENY_PREFIX);
export const isAppealApprove = (id: string): boolean => id.startsWith(APPEAL_APPROVE_PREFIX);
export const isAppealDeny = (id: string): boolean => id.startsWith(APPEAL_DENY_PREFIX);

async function disableAppealButtons(interaction: ButtonInteraction, _label: string): Promise<void> {
  try {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("mod:appeal:approve:_done")
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("mod:appeal:deny:_done")
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
    );
    await interaction.message.edit({
      components: [row],
      embeds: [
        ...(interaction.message.embeds ?? []),
      ],
    });
  } catch { /* best-effort */ }
}

// ─── Step 1: User clicks appeal in their DM ──────────────────────────────────

export async function handleAppealButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.customId.slice(APPEAL_PREFIX.length);

  // Find the guild
  const guild = interaction.client.guilds.cache.get(guildId);
  if (!guild) {
    await interaction.editReply({ content: "Could not find the server. It may no longer exist." });
    return;
  }

  const guildResult = await getGuild(guildId);
  if (guildResult.isErr() || !guildResult.unwrap()) {
    await interaction.editReply({ content: "Failed to load server config." });
    return;
  }

  const appealsChannelId = guildResult.unwrap()!.moderation.appealsChannelId;
  if (!appealsChannelId) {
    await interaction.editReply({ content: "This server has not set up a ban appeals channel. Contact a moderator directly." });
    return;
  }

  const channel = await guild.channels.fetch(appealsChannelId).catch(() => null);
  if (!channel?.isTextBased() || !("threads" in channel)) {
    await interaction.editReply({ content: "The appeals channel is not accessible." });
    return;
  }

  try {
    const thread = await (channel as TextChannel).threads.create({
      name: `Appeal — ${interaction.user.tag}`,
      autoArchiveDuration: 1440, // 24h
      type: ChannelType.PrivateThread,
      reason: `Ban appeal from ${interaction.user.tag}`,
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle("Ban Appeal")
      .setDescription(`<@${interaction.user.id}> has submitted a ban appeal.`)
      .addFields(
        { name: "User", value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
        { name: "User ID", value: interaction.user.id, inline: true },
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:appeal:approve:${interaction.user.id}:${guildId}`)
        .setLabel("Approve (Unban)")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mod:appeal:deny:${interaction.user.id}:${guildId}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger),
    );

    await thread.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "Your appeal has been submitted. A moderator will review it soon." });
  } catch (err) {
    log.error("Failed to create appeal thread", err);
    await interaction.editReply({ content: "Failed to submit your appeal. Please contact a moderator directly." });
  }
}

// ─── Step 2a: Mod approves appeal ────────────────────────────────────────────

export async function handleAppealApprove(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  await disableAppealButtons(interaction, "Approved");

  const [userId, guildId] = interaction.customId.slice(APPEAL_APPROVE_PREFIX.length).split(":");
  const guild = interaction.guild ?? interaction.client.guilds.cache.get(guildId);

  if (!guild || !userId) {
    await interaction.editReply({ content: "Invalid appeal data." });
    return;
  }

  try {
    await guild.members.unban(userId, `Appeal approved by ${interaction.user.tag}`);
    await interaction.editReply({ content: `<@${userId}> has been unbanned.` });

    // Archive the thread
    if (interaction.channel?.isThread()) {
      await interaction.channel.setArchived(true, "Appeal resolved").catch(() => {});
    }
  } catch (err) {
    log.error("Failed to unban on appeal", err);
    await interaction.editReply({ content: "Failed to unban the user." });
  }
}

// ─── Step 2b: Mod denies appeal ───────────────────────────────────────────────

export async function handleAppealDeny(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  await disableAppealButtons(interaction, "Denied");

  await interaction.editReply({ content: "Appeal denied." });

  if (interaction.channel?.isThread()) {
    await interaction.channel.setArchived(true, "Appeal denied").catch(() => {});
  }
}

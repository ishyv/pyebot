/**
 * Button handlers for the cross-channel spam mod alert.
 *
 * Buttons are posted by crossChannelSpam.ts when a spam event is detected.
 * Each handler:
 *   1. Disables all buttons on the alert message (prevent double-action)
 *   2. Executes the action
 *   3. Replies ephemerally with the outcome
 */

import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:spam-alert");

export const SPAM_TIMEOUT_PREFIX = "automod:spam:timeout:";
export const SPAM_BAN_PREFIX = "automod:spam:ban:";
export const SPAM_DISMISS_PREFIX = "automod:spam:dismiss:";

export const isSpamTimeout = (id: string): boolean => id.startsWith(SPAM_TIMEOUT_PREFIX);
export const isSpamBan = (id: string): boolean => id.startsWith(SPAM_BAN_PREFIX);
export const isSpamDismiss = (id: string): boolean => id.startsWith(SPAM_DISMISS_PREFIX);

// ─── Shared ──────────────────────────────────────────────────────────────────

/** Replaces the alert's button row with disabled copies so it can't be clicked twice. */
async function disableButtons(interaction: ButtonInteraction): Promise<void> {
  try {
    const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("automod:spam:timeout:_done")
        .setLabel("Timeout 1h")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("automod:spam:ban:_done")
        .setLabel("Ban")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("automod:spam:dismiss:_done")
        .setLabel("Dismiss")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
    await interaction.message.edit({ components: [disabledRow] });
  } catch { /* best-effort */ }
}

// ─── Timeout ─────────────────────────────────────────────────────────────────

export async function handleSpamTimeout(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await disableButtons(interaction);

  const userId = interaction.customId.slice(SPAM_TIMEOUT_PREFIX.length);
  if (!interaction.guild) {
    await interaction.editReply({ content: "Cannot perform this action outside a server." });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(userId);
    await member.timeout(60 * 60 * 1000, `Cross-channel spam — actioned by ${interaction.user.tag}`);
    await interaction.editReply({ content: `<@${userId}> has been timed out for 1 hour.` });
  } catch (err) {
    log.error("Spam alert timeout failed", err);
    await interaction.editReply({ content: "Failed to apply timeout. The user may have left the server." });
  }
}

// ─── Ban ─────────────────────────────────────────────────────────────────────

export async function handleSpamBan(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await disableButtons(interaction);

  const userId = interaction.customId.slice(SPAM_BAN_PREFIX.length);
  if (!interaction.guild) {
    await interaction.editReply({ content: "Cannot perform this action outside a server." });
    return;
  }

  try {
    await interaction.guild.members.ban(userId, {
      reason: `Cross-channel spam — actioned by ${interaction.user.tag}`,
      deleteMessageSeconds: 60 * 60 * 24, // delete messages from last 24h
    });
    await interaction.editReply({ content: `<@${userId}> has been banned.` });
  } catch (err) {
    log.error("Spam alert ban failed", err);
    await interaction.editReply({ content: "Failed to ban the user." });
  }
}

// ─── Dismiss ─────────────────────────────────────────────────────────────────

export async function handleSpamDismiss(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await disableButtons(interaction);
  await interaction.editReply({ content: "Alert dismissed. No further action taken." });
}

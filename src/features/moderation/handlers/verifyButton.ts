/**
 * Button handler for the verification gate prompt.
 * customId: "mod:verify:{userId}"
 */

import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

const log = createLogger("moderation:verify-button");

export const VERIFY_PREFIX = "mod:verify:";
export const isVerifyButton = (id: string): boolean => id.startsWith(VERIFY_PREFIX);

async function disableButton(interaction: ButtonInteraction): Promise<void> {
  try {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("mod:verify:_done")
        .setLabel("✓ Verified")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
    );
    await interaction.message.edit({ components: [row] });
  } catch { /* best-effort */ }
}

export async function handleVerifyButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "Server only." });
    return;
  }

  const targetUserId = interaction.customId.slice(VERIFY_PREFIX.length);

  // Only the intended user can click the button
  if (interaction.user.id !== targetUserId) {
    await interaction.editReply({ content: "This verify button is not for you." });
    return;
  }

  const guildResult = await getGuild(interaction.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) {
    await interaction.editReply({ content: "Failed to load server config." });
    return;
  }

  const roleId = guildResult.unwrap()!.moderation.verification.roleId;
  if (!roleId) {
    await interaction.editReply({ content: "Verification role is not configured. Please contact a moderator." });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    await member.roles.add(roleId, "Verification gate passed");
    await disableButton(interaction);
    await interaction.editReply({ content: "You have been verified! Welcome to the server." });
  } catch (err) {
    log.error("Failed to assign verified role", err);
    await interaction.editReply({ content: "Failed to verify you. Please contact a moderator." });
  }
}

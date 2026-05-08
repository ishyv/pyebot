/**
 * Button handlers for the raid detection alert embed.
 */

import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ButtonInteraction,
  type TextChannel,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:raid-alert");

export const RAID_LOCKDOWN_PREFIX = "automod:raid:lockdown:";
export const RAID_DISMISS_PREFIX = "automod:raid:dismiss:";

export const isRaidLockdown = (id: string): boolean => id.startsWith(RAID_LOCKDOWN_PREFIX);
export const isRaidDismiss = (id: string): boolean => id.startsWith(RAID_DISMISS_PREFIX);

async function disableButtons(interaction: ButtonInteraction): Promise<void> {
  try {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("automod:raid:lockdown:_done")
        .setLabel("Lockdown Server")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("automod:raid:dismiss:_done")
        .setLabel("Dismiss")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
    await interaction.message.edit({ components: [row] });
  } catch { /* best-effort */ }
}

export async function handleRaidLockdown(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await disableButtons(interaction);

  if (!interaction.guild) {
    await interaction.editReply({ content: "Cannot lock down outside a server." });
    return;
  }

  const textChannels = interaction.guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement,
  );

  let updated = 0;
  await Promise.allSettled(
    [...textChannels.values()].map(async (c) => {
      try {
        await (c as TextChannel).permissionOverwrites.edit(
          interaction.guild!.roles.everyone,
          { SendMessages: false },
          { reason: `Raid lockdown — actioned by ${interaction.user.tag}` },
        );
        updated++;
      } catch { /* channel may lack perms */ }
    }),
  );

  log.info(`Raid lockdown actioned by ${interaction.user.tag}: ${updated} channels locked`);
  await interaction.editReply({ content: `🔒 Server locked down — ${updated} channels updated.` });
}

export async function handleRaidDismiss(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await disableButtons(interaction);
  await interaction.editReply({ content: "Raid alert dismissed." });
}

/**
 * Button handlers for the raid detection alert embed.
 */

import {
  ActionRowBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  type TextChannel,
} from "discord.js";
import { createLogger } from "@/core/logger";
import { guardModerationComponentAction } from "@/features/moderation/authorization";
import { routes } from "../routes";

const log = createLogger("automod:raid-alert");

async function disableButtons(interaction: ButtonInteraction): Promise<void> {
  try {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      routes["raid-lockdown"].button(
        {},
        { label: "Lockdown Server", style: ButtonStyle.Danger, disabled: true },
      ),
      routes["raid-dismiss"].button(
        {},
        { label: "Dismiss", style: ButtonStyle.Secondary, disabled: true },
      ),
    );
    await interaction.message.edit({ components: [row] });
  } catch {
    /* best-effort */
  }
}

export async function handleRaidLockdown(interaction: ButtonInteraction): Promise<void> {
  if (!(await guardModerationComponentAction(interaction, "LOCKDOWN"))) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await disableButtons(interaction);

  if (!interaction.guild) {
    await interaction.editReply({ content: "Cannot lock down outside a server." });
    return;
  }

  const guild = interaction.guild;
  const textChannels = guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement,
  );

  let updated = 0;
  await Promise.allSettled(
    [...textChannels.values()].map(async (c) => {
      try {
        await (c as TextChannel).permissionOverwrites.edit(
          guild.roles.everyone,
          { SendMessages: false },
          { reason: `Raid lockdown — actioned by ${interaction.user.tag}` },
        );
        updated++;
      } catch {
        /* channel may lack perms */
      }
    }),
  );

  log.info(`Raid lockdown actioned by ${interaction.user.tag}: ${updated} channels locked`);
  await interaction.editReply({ content: `🔒 Server locked down — ${updated} channels updated.` });
}

export async function handleRaidDismiss(interaction: ButtonInteraction): Promise<void> {
  if (!(await guardModerationComponentAction(interaction, "WARN"))) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await disableButtons(interaction);
  await interaction.editReply({ content: "Raid alert dismissed." });
}

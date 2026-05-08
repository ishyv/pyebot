/**
 * Ticket close button handler.
 *
 * Handles button interactions with customId `tickets:close:{channelId}`.
 * Deletes the channel and removes it from the guild's pendingTickets.
 */

import { MessageFlags, type ButtonInteraction } from "discord.js";
import { closeTicket } from "@/features/tickets/service";
import { TICKET_CLOSE_BUTTON_PREFIX } from "@/features/tickets/commands/ticket";

export function isTicketCloseButton(customId: string): boolean {
  return customId.startsWith(TICKET_CLOSE_BUTTON_PREFIX);
}

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.slice(TICKET_CLOSE_BUTTON_PREFIX.length);
  if (!channelId) {
    await interaction.reply({ content: "Invalid close button.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Cannot close ticket outside of a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content: "Closing ticket...", flags: MessageFlags.Ephemeral });
  await closeTicket(guild, channelId, interaction.user.id);
}

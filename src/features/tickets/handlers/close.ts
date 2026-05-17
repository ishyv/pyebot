/**
 * Ticket close button handler.
 *
 * Handles button interactions with customId `tickets:close:{channelId}`.
 * Deletes the channel and removes it from the guild's pendingTickets.
 */

import { type ButtonInteraction, MessageFlags } from "discord.js";
import { TICKET_CLOSE_BUTTON_PREFIX } from "@/features/tickets/customIds";
import { closeTicket } from "@/features/tickets/service";
import type { Ctx } from "@/framework/types";

export function isTicketCloseButton(customId: string): boolean {
  return customId.startsWith(TICKET_CLOSE_BUTTON_PREFIX);
}

export async function handleTicketClose(interaction: ButtonInteraction, ctx: Ctx): Promise<void> {
  const channelId = interaction.customId.slice(TICKET_CLOSE_BUTTON_PREFIX.length);
  if (!channelId) {
    await interaction.reply({ content: "Invalid close button.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "Cannot close ticket outside of a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({ content: "Closing ticket...", flags: MessageFlags.Ephemeral });
  await closeTicket(ctx, guild, channelId, interaction.user.id);
}

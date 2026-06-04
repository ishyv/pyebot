/**
 * Ticket close button handler.
 *
 * Routed from `tickets:close:<channelId>` (see ../routes.ts). Deletes the channel
 * and removes it from the guild's pendingTickets. The channel id arrives decoded
 * and validated by the route's snowflake codec.
 */

import { type ButtonInteraction, MessageFlags } from "discord.js";
import { closeTicket } from "@/features/tickets/service";
import type { Ctx } from "@/framework/types";

export async function handleTicketClose(
  interaction: ButtonInteraction,
  ctx: Ctx,
  channelId: string,
): Promise<void> {
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

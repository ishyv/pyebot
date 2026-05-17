import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { channelMention, coreChannelValue, renderChannelPairPanel } from "../panelHelpers";
import type { PanelPayload, PanelState } from "../panelRuntime";

const TICKET_FIELDS = [
  { value: "channels.core.tickets", label: "Ticket prompt channel" },
  { value: "channels.core.ticketLogs", label: "Ticket log channel" },
  { value: "channels.ticketCategoryId", label: "Ticket category" },
] as const;

/** Renders ticket channel pickers and current state. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  return renderChannelPairPanel(
    session,
    "tickets",
    "Tickets Panel",
    session.selectedTicketField,
    TICKET_FIELDS,
    [
      { name: "Prompt", value: channelMention(coreChannelValue(cfg, "tickets")), inline: true },
      {
        name: "Category",
        value: channelMention(
          cfg.channels.ticketCategoryId ?? coreChannelValue(cfg, "ticketCategory"),
        ),
        inline: true,
      },
      { name: "Logs", value: channelMention(coreChannelValue(cfg, "ticketLogs")), inline: true },
      { name: "Prompt message", value: cfg.channels.ticketMessageId ?? "Not posted", inline: true },
    ],
  );
}

/**
 * Handles field selection and channel assignment.
 * The ticket category writes to two paths because the schema stores it redundantly.
 */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && actionStr === "field") {
    session.selectedTicketField = interaction.values[0];
    return true;
  }
  if (interaction.isChannelSelectMenu() && actionStr === "set-channel") {
    if (!session.selectedTicketField) throw new Error("Choose a ticket field first.");
    const channelId = interaction.values[0];
    if (session.selectedTicketField === "channels.ticketCategoryId") {
      await updateGuildPaths(
        session.guildId,
        { "channels.ticketCategoryId": channelId, "channels.core.ticketCategory": { channelId } },
        { upsert: true },
      );
    } else {
      await updateGuildPaths(
        session.guildId,
        { [session.selectedTicketField]: { channelId } },
        { upsert: true },
      );
    }
  }
  return true;
}

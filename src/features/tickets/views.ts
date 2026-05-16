/**
 * Tickets feature views.
 *
 * Pure render functions: domain state in → V2 payload out. No Discord
 * fetches or side effects happen here.
 */

import { ButtonBuilder, ButtonStyle } from "discord.js";
import { container, section, v2Message } from "@/ui/v2";
import type { V2Payload } from "@/ui/views";

interface TicketWelcomeArgs {
  readonly categoryEmoji: string;
  readonly categoryLabel: string;
  /** ID of the user who opened the ticket — rendered as a mention. */
  readonly userId: string;
  /**
   * Full customId for the Close Ticket button. The caller constructs this so
   * views.ts stays decoupled from the customId scheme.
   */
  readonly closeCustomId: string;
}

/**
 * Renders the welcome card posted to a newly-opened ticket channel.
 *
 * Uses a Section with the close button as the accessory so the button sits
 * inline with the heading rather than below it — this is the V2 pattern that
 * makes the UI feel app-like instead of embed + row.
 */
export function renderTicketWelcome(args: TicketWelcomeArgs): V2Payload {
  const closeButton = new ButtonBuilder()
    .setCustomId(args.closeCustomId)
    .setLabel("Close Ticket")
    .setStyle(ButtonStyle.Danger);

  const heading = [
    `## ${args.categoryEmoji} ${args.categoryLabel}`,
    `Welcome <@${args.userId}>!`,
    "",
    "Please describe your request and wait for a staff member to respond.",
  ].join("\n");

  return v2Message(container("info", section(heading, closeButton)));
}

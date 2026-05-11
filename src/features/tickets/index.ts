import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { Button, Feature, SlashCommand } from "@/framework";
import * as ticketCmd from "./commands/ticket";
import { TICKET_CLOSE_BUTTON_PREFIX } from "./commands/ticket";
import { handleTicketClose } from "./handlers/close";

@Feature({ id: "tickets", gate: "tickets", intents: ["Guilds"] })
export default class TicketsFeature {
  @SlashCommand({
    name: ticketCmd.data.name,
    description: "Ticket system",
    data: ticketCmd.data,
  })
  async ticket(interaction: ChatInputCommandInteraction): Promise<void> {
    await ticketCmd.execute(interaction);
  }

  @Button({ prefix: TICKET_CLOSE_BUTTON_PREFIX })
  async close(interaction: ButtonInteraction): Promise<void> {
    await handleTicketClose(interaction);
  }
}

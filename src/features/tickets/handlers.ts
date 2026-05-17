import type { ButtonInteraction } from "discord.js";
import { Handle } from "@/framework";
import type { Ctx } from "@/framework/types";
import { TICKET_CLOSE_BUTTON_PREFIX } from "./customIds";
import { handleTicketClose } from "./handlers/close";

export default class TicketHandlers {
  @Handle(TICKET_CLOSE_BUTTON_PREFIX)
  async onTicketClose(interaction: ButtonInteraction, ctx: Ctx): Promise<void> {
    await handleTicketClose(interaction, ctx);
  }
}

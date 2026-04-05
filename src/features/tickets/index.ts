import type { FeatureModule, ComponentInteraction } from "@/core/feature";
import type { ButtonInteraction } from "discord.js";
import * as ticketCmd from "./commands/ticket";
import { isTicketCloseButton, handleTicketClose } from "./handlers/close";

const tickets: FeatureModule = {
  id: "tickets",
  featureGate: "tickets",
  commands: [
    { data: ticketCmd.data, execute: ticketCmd.execute },
  ],
  components: [
    {
      prefix: "tickets:close:",
      matches: isTicketCloseButton,
      handle: (i: ComponentInteraction) => handleTicketClose(i as ButtonInteraction),
    },
  ],
};

export default tickets;

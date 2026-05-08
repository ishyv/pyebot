import type { ButtonInteraction } from "discord.js";
import { Button, Feature, SlashCommand } from "@/framework";
import * as offerCmd from "./commands/offer";
import { handleOfferReview } from "./handlers/review";
import {
  OFFER_APPROVE_PREFIX,
  OFFER_REJECT_PREFIX,
  OFFER_CHANGES_PREFIX,
} from "./service";

@Feature({ id: "offers", intents: ["Guilds"] })
export default class OffersFeature {
  @SlashCommand({ name: offerCmd.data.name, description: "Create or review offers", data: offerCmd.data })
  async offer(...args: Parameters<typeof offerCmd.execute>): Promise<void> {
    await offerCmd.execute(...args);
  }

  @Button<ButtonInteraction>({ prefix: OFFER_APPROVE_PREFIX })
  @Button<ButtonInteraction>({ prefix: OFFER_REJECT_PREFIX })
  @Button<ButtonInteraction>({ prefix: OFFER_CHANGES_PREFIX })
  async review(interaction: ButtonInteraction): Promise<void> {
    await handleOfferReview(interaction);
  }
}

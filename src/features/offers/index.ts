import type { FeatureModule, ComponentInteraction } from "@/core/feature";
import type { ButtonInteraction } from "discord.js";
import * as offerCmd from "./commands/offer";
import { isOfferReviewButton, handleOfferReview } from "./handlers/review";
import {
  OFFER_APPROVE_PREFIX,
  OFFER_REJECT_PREFIX,
  OFFER_CHANGES_PREFIX,
} from "./service";

const offers: FeatureModule = {
  id: "offers",
  commands: [
    { data: offerCmd.data, execute: offerCmd.execute },
  ],
  components: [
    {
      prefix: `${OFFER_APPROVE_PREFIX}|${OFFER_REJECT_PREFIX}|${OFFER_CHANGES_PREFIX}`,
      matches: isOfferReviewButton,
      handle: (i: ComponentInteraction) => handleOfferReview(i as ButtonInteraction),
    },
  ],
};

export default offers;

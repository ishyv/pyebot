import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { channelMention, coreChannelValue, renderChannelPairPanel } from "../panelHelpers";
import type { PanelPayload, PanelState } from "../panelRuntime";

const OFFER_FIELDS = [
  { value: "channels.core.offersReview", label: "Review channel" },
  { value: "channels.core.approvedOffers", label: "Approved offers channel" },
] as const;

/** Renders the two offer channel pickers. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  return renderChannelPairPanel(
    session,
    "offers",
    "Offers Panel",
    session.selectedOfferField,
    OFFER_FIELDS,
    [
      {
        name: "Review",
        value: channelMention(coreChannelValue(cfg, "offersReview")),
        inline: true,
      },
      {
        name: "Approved",
        value: channelMention(coreChannelValue(cfg, "approvedOffers")),
        inline: true,
      },
    ],
  );
}

/** Handles field selection and channel assignment for the offers panel. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && actionStr === "field") {
    session.selectedOfferField = interaction.values[0];
    return true;
  }
  if (interaction.isChannelSelectMenu() && actionStr === "set-channel") {
    if (!session.selectedOfferField) throw new Error("Choose an offer channel field first.");
    await updateGuildPaths(
      session.guildId,
      { [session.selectedOfferField]: { channelId: interaction.values[0] } },
      { upsert: true },
    );
  }
  return true;
}

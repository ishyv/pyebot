import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { applyGuildConfigPaths } from "../configMutations";
import { channelMention, coreChannelValue, roleMention } from "../panelHelpers";
import { makePanelCustomId, panelContainer, type PanelPayload, type PanelState } from "../panelRuntime";

const CHANNEL_FIELDS = [
  { value: "channels.core.offersReview", label: "Review channel" },
  { value: "channels.core.approvedOffers", label: "Approved offers channel" },
] as const;

export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  const allowedRoles: string[] = cfg.offersConfig?.allowedRoleIds ?? [];

  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "offers", "field"))
    .setPlaceholder("Choose channel to configure")
    .addOptions(
      CHANNEL_FIELDS.map((f) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(f.label)
          .setValue(f.value)
          .setDefault(session.selectedOfferField === f.value),
      ),
    );

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "offers", "set-channel"))
    .setPlaceholder("Set selected channel")
    .setMinValues(1)
    .setMaxValues(1);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "offers", "allowed-roles"))
    .setPlaceholder("Allowed submitter roles (empty = everyone)")
    .setMinValues(0)
    .setMaxValues(25);

  return {
    container: panelContainer({
      title: "Offers Panel",
      description: `Selected field: **${session.selectedOfferField ?? "none"}**`,
      fields: [
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
        {
          name: "Allowed submitters",
          value:
            allowedRoles.length > 0
              ? allowedRoles.map((id) => roleMention(id)).join(", ")
              : "Everyone",
          inline: false,
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect),
    ],
  };
}

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
    if (!session.selectedOfferField) throw new Error("Choose a channel field first.");
    await applyGuildConfigPaths(
      session.guildId,
      { [session.selectedOfferField]: { channelId: interaction.values[0] } },
      { upsert: true },
    );
    return true;
  }

  if (interaction.isRoleSelectMenu() && actionStr === "allowed-roles") {
    // Empty selection means "clear the restriction" (open submission).
    await applyGuildConfigPaths(
      session.guildId,
      { "offersConfig.allowedRoleIds": interaction.values },
      { upsert: true },
    );
    return true;
  }

  return true;
}

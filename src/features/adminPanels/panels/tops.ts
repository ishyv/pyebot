import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { channelMention, loadGuildConfig, modalInput } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/** Renders tops channel, cadence, and size. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  return {
    container: panelContainer({
      title: "Tops Panel",
      fields: [
        { name: "Enabled", value: cfg.tops.enabled ? "Enabled" : "Disabled", inline: true },
        { name: "Channel", value: channelMention(cfg.tops.channelId), inline: true },
        {
          name: "Cadence",
          value: `Every ${cfg.tops.intervalHours}h\nTop ${cfg.tops.topSize}`,
          inline: true,
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "tops", "channel"))
          .setPlaceholder("Set tops report channel")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "tops", "toggle"))
          .setLabel("Toggle tops")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "tops", "config-modal"))
          .setLabel("Set cadence")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

/** Handles channel selection, toggle, and cadence modal for tops. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (actionStr === "toggle")
    await updateGuildPaths(
      session.guildId,
      { "tops.enabled": !cfg.tops.enabled },
      { upsert: true },
    );
  if (interaction.isChannelSelectMenu() && actionStr === "channel")
    await updateGuildPaths(
      session.guildId,
      { "tops.channelId": interaction.values[0] },
      { upsert: true },
    );
  if (actionStr === "config-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "tops", "config-submit"))
      .setTitle("Tops cadence")
      .addComponents(
        modalInput("hours", "Interval hours", "24", true),
        modalInput("size", "Top size", "10", true),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "config-submit" && interaction.isModalSubmit()) {
    const hours = Number(interaction.fields.getTextInputValue("hours"));
    const size = Number(interaction.fields.getTextInputValue("size"));
    if (!Number.isInteger(hours) || hours < 1 || !Number.isInteger(size) || size < 1 || size > 25)
      throw new Error("Use interval >= 1 and top size 1-25.");
    await updateGuildPaths(
      session.guildId,
      { "tops.intervalHours": hours, "tops.topSize": size },
      { upsert: true },
    );
  }
  return true;
}

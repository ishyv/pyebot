import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { applyGuildConfigPaths } from "../configMutations";
import {
  CORE_CHANNEL_DEFINITIONS,
  channelMention,
  coreChannelValue,
  limitText,
  modalInput,
} from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/** Renders core and managed channel configuration. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  const coreLines = Object.entries(CORE_CHANNEL_DEFINITIONS).map(
    ([key, label]) => `**${key}** - ${label}: ${channelMention(coreChannelValue(cfg, key))}`,
  );
  const managedEntries = Object.values(cfg.channels.managed);
  const managed = managedEntries.map(
    (entry) => `**${entry.id}** - ${entry.label}: <#${entry.channelId}>`,
  );
  const slotSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "slot"))
    .setPlaceholder("Choose a core channel slot")
    .addOptions(
      Object.entries(CORE_CHANNEL_DEFINITIONS)
        .slice(0, 25)
        .map(([key, label]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(key)
            .setDescription(label)
            .setValue(key)
            .setDefault(session.selectedChannelSlot === key),
        ),
    );
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "set-core"))
    .setPlaceholder("Set selected slot to this channel")
    .setMinValues(1)
    .setMaxValues(1);
  const managedChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "managed-channel"))
    .setPlaceholder("Pick channel for a new managed entry")
    .setMinValues(1)
    .setMaxValues(1);
  const addButton = new ButtonBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "managed-add-modal"))
    .setLabel("Add managed channel")
    .setStyle(ButtonStyle.Primary);
  const removeSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "managed-remove"))
    .setPlaceholder("Remove managed channel")
    .setDisabled(managedEntries.length === 0)
    .addOptions(
      (managedEntries.length
        ? managedEntries
        : [{ id: "none", label: "No entries", channelId: "0" }]
      )
        .slice(0, 25)
        .map((entry) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(entry.label)
            .setDescription(entry.id)
            .setValue(entry.id),
        ),
    );
  return {
    container: panelContainer({
      title: "Channels Panel",
      description: `Selected core slot: **${session.selectedChannelSlot ?? "none"}**\nPending managed channel: ${channelMention(session.pendingManagedChannelId)}`,
      fields: [
        { name: "Core channels", value: limitText(coreLines.join("\n"), 1000) },
        {
          name: "Managed channels",
          value: limitText(managed.length ? managed.join("\n") : "Nothing configured.", 1000),
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(slotSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(managedChannelSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(addButton),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeSelect),
    ],
  };
}

/** Handles slot selection, core channel writes, and managed channel CRUD. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && actionStr === "slot") {
    session.selectedChannelSlot = interaction.values[0] ?? session.selectedChannelSlot;
    return true;
  }
  if (interaction.isChannelSelectMenu() && actionStr === "set-core") {
    const slot = session.selectedChannelSlot;
    if (!slot) throw new Error("Choose a core channel slot first.");
    const channelId = interaction.values[0];
    const patch: Record<string, unknown> = { [`channels.core.${slot}`]: { channelId } };
    if (slot === "ticketCategory") patch["channels.ticketCategoryId"] = channelId;
    await applyGuildConfigPaths(session.guildId, patch, { upsert: true });
    return true;
  }
  if (interaction.isChannelSelectMenu() && actionStr === "managed-channel") {
    session.pendingManagedChannelId = interaction.values[0];
    return true;
  }
  if (actionStr === "managed-add-modal" && interaction.isButton()) {
    if (!session.pendingManagedChannelId)
      throw new Error("Pick a channel before adding a managed entry.");
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "channels", "managed-add-submit"))
      .setTitle("Add managed channel")
      .addComponents(modalInput("label", "Label", "staff-alerts", true));
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "managed-add-submit" && interaction.isModalSubmit()) {
    const label = interaction.fields.getTextInputValue("label").trim();
    const id =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || Date.now().toString(36);
    await applyGuildConfigPaths(
      session.guildId,
      { [`channels.managed.${id}`]: { id, label, channelId: session.pendingManagedChannelId } },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isStringSelectMenu() && actionStr === "managed-remove") {
    const id = interaction.values[0];
    if (id && id !== "none")
      await applyGuildConfigPaths(session.guildId, {}, { unset: [`channels.managed.${id}`] });
  }
  return true;
}

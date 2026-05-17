import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import {
  channelMention,
  loadGuildConfig,
  modalInput,
  roleMention,
  showOneInputModal,
  yesNo,
} from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

const MODERATION_CHANNEL_FIELDS = [
  { value: "moderation.modLogChannelId", label: "Mod log channel" },
  { value: "moderation.appealsChannelId", label: "Appeals channel" },
  { value: "moderation.quarantine.channelId", label: "Quarantine channel" },
  { value: "moderation.verification.channelId", label: "Verification channel" },
] as const;

/** Renders moderation channel fields, escalation, quarantine, and verification state. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  const mod = cfg.moderation;
  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "moderation", "channel-field"))
    .setPlaceholder("Choose moderation channel field")
    .addOptions(
      MODERATION_CHANNEL_FIELDS.map((field) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(field.label)
          .setValue(field.value)
          .setDefault(session.selectedModerationField === field.value),
      ),
    );
  return {
    container: panelContainer({
      title: "Moderation Panel",
      description: `Selected field: **${session.selectedModerationField ?? "none"}**`,
      fields: [
        {
          name: "Channels",
          value: [
            `Mod log: ${channelMention(mod.modLogChannelId)}`,
            `Appeals: ${channelMention(mod.appealsChannelId)}`,
            `Quarantine: ${channelMention(mod.quarantine.channelId)}`,
            `Verification: ${channelMention(mod.verification.channelId)}`,
          ].join("\n"),
        },
        {
          name: "Escalation",
          value: `${yesNo(mod.escalation.enabled)} - ${mod.escalation.thresholds.length} threshold(s)`,
          inline: true,
        },
        {
          name: "Quarantine",
          value: `${yesNo(mod.quarantine.enabled)}\nRole: ${roleMention(mod.quarantine.roleId)}`,
          inline: true,
        },
        {
          name: "Verification",
          value: `${yesNo(mod.verification.enabled)}\nMode: ${mod.verification.mode}\nRole: ${roleMention(mod.verification.roleId)}\nMin age: ${mod.verification.minAccountAgeDays}d`,
          inline: true,
        },
        { name: "Alt detection", value: yesNo(mod.altDetectionEnabled), inline: true },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "set-channel"))
          .setPlaceholder("Set chosen channel field")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "set-role"))
          .setPlaceholder("Set quarantine/verification role")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-alt"))
          .setLabel("Toggle alt")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-escalation"))
          .setLabel("Toggle escalation")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-quarantine"))
          .setLabel("Toggle quarantine")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-verification"))
          .setLabel("Toggle verification")
          .setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "verify-age-modal"))
          .setLabel("Set verify age")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "escalation-modal"))
          .setLabel("Add escalation")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "clear-escalation"))
          .setLabel("Clear escalation")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

/** Handles channel/role field picks, toggles, and escalation threshold modal. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (interaction.isStringSelectMenu() && actionStr === "channel-field") {
    session.selectedModerationField = interaction.values[0];
    return true;
  }
  if (interaction.isChannelSelectMenu() && actionStr === "set-channel") {
    if (!session.selectedModerationField)
      throw new Error("Choose a moderation channel field first.");
    await updateGuildPaths(
      session.guildId,
      { [session.selectedModerationField]: interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isRoleSelectMenu() && actionStr === "set-role") {
    const field = session.selectedModerationField?.includes("verification")
      ? "moderation.verification.roleId"
      : "moderation.quarantine.roleId";
    await updateGuildPaths(session.guildId, { [field]: interaction.values[0] }, { upsert: true });
    return true;
  }
  if (actionStr === "toggle-alt")
    await updateGuildPaths(
      session.guildId,
      { "moderation.altDetectionEnabled": !cfg.moderation.altDetectionEnabled },
      { upsert: true },
    );
  if (actionStr === "toggle-escalation")
    await updateGuildPaths(
      session.guildId,
      { "moderation.escalation.enabled": !cfg.moderation.escalation.enabled },
      { upsert: true },
    );
  if (actionStr === "toggle-quarantine")
    await updateGuildPaths(
      session.guildId,
      { "moderation.quarantine.enabled": !cfg.moderation.quarantine.enabled },
      { upsert: true },
    );
  if (actionStr === "toggle-verification")
    await updateGuildPaths(
      session.guildId,
      { "moderation.verification.enabled": !cfg.moderation.verification.enabled },
      { upsert: true },
    );
  if (actionStr === "clear-escalation")
    await updateGuildPaths(
      session.guildId,
      { "moderation.escalation.thresholds": [] },
      { upsert: true },
    );
  if (actionStr === "verify-age-modal" && interaction.isButton()) {
    await showOneInputModal(
      interaction,
      session,
      "moderation",
      "verify-age-submit",
      "Verification age",
      "days",
      "Minimum account age in days",
      "0",
    );
    return false;
  }
  if (actionStr === "verify-age-submit" && interaction.isModalSubmit()) {
    const days = Number(interaction.fields.getTextInputValue("days"));
    if (!Number.isInteger(days) || days < 0 || days > 365)
      throw new Error("Age must be a whole number from 0 to 365.");
    await updateGuildPaths(
      session.guildId,
      { "moderation.verification.minAccountAgeDays": days },
      { upsert: true },
    );
  }
  if (actionStr === "escalation-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "moderation", "escalation-submit"))
      .setTitle("Add escalation threshold")
      .addComponents(
        modalInput("warns", "Warn count", "3", true),
        modalInput("action", "Action: timeout, kick, ban", "timeout", true),
        modalInput("duration", "Timeout duration", "1h", false),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "escalation-submit" && interaction.isModalSubmit()) {
    const warnCount = Number(interaction.fields.getTextInputValue("warns"));
    const thresholdAction = interaction.fields.getTextInputValue("action").trim().toLowerCase();
    const durationKey = interaction.fields.getTextInputValue("duration").trim() || undefined;
    if (!Number.isInteger(warnCount) || warnCount < 1)
      throw new Error("Warn count must be a positive whole number.");
    if (!["timeout", "kick", "ban"].includes(thresholdAction))
      throw new Error("Action must be timeout, kick, or ban.");
    await updateGuildPaths(
      session.guildId,
      {
        "moderation.escalation.thresholds": [
          ...cfg.moderation.escalation.thresholds,
          {
            warnCount,
            action: thresholdAction as "timeout" | "kick" | "ban",
            ...(durationKey ? { durationKey } : {}),
          },
        ],
      },
      { upsert: true },
    );
  }
  return true;
}

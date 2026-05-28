/**
 * Shared helpers for admin panel renderers and action handlers.
 *
 * Display utilities, data loaders, and the reusable channel-pair renderer
 * live here. Domain-specific logic belongs in each panel's own file under
 * `panels/`.
 */
import {
  ActionRowBuilder,
  type APIEmbedField,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildFeaturesValue } from "@/components/guild-features";
import { getGuildFeatures } from "@/components/guild-features";
import { ensureGuild, getGuild } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import {
  makePanelCustomId,
  type PanelId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "./panelRuntime";

/** Core channel slot keys mapped to moderator-readable labels. */
export const CORE_CHANNEL_DEFINITIONS: Record<string, string> = {
  welcome: "Welcome messages",
  goodbye: "Goodbye messages",
  logs: "General logs",
  reports: "Report inbox",
  suggestions: "Suggestions",
  tickets: "Ticket prompt channel",
  messageLogs: "Moderation message logs",
  voiceLogs: "Voice activity logs",
  ticketLogs: "Ticket logs",
  ticketCategory: "Ticket category",
  pointsLog: "Points log",
  generalLogs: "Server events",
  banSanctions: "Sanction history",
  staff: "Staff alerts",
  repRequests: "Reputation requests",
  offersReview: "Offer review",
  approvedOffers: "Approved offers",
};

export function yesNo(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}

export function channelMention(channelId: string | null | undefined): string {
  return channelId ? `<#${channelId}>` : "Not set";
}

export function roleMention(roleId: string | null | undefined): string {
  return roleId ? `<@&${roleId}>` : "Not set";
}

/** Truncates a string to stay within Discord embed field limits. */
export function limitText(value: unknown, max = 1000): string {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

/** Reads a core channel slot's channelId from guild config. */
export function coreChannelValue(cfg: GuildConfig, key: string): string | null {
  return cfg.channels.core[key]?.channelId ?? null;
}

/** Loads guild config, creating a default document if not yet present. */
export async function loadGuildConfig(guildId: string): Promise<GuildConfig> {
  const existing = await getGuild(guildId);
  const existingGuild = existing.isOk() ? existing.unwrap() : null;
  if (existingGuild) return existingGuild;
  const ensured = await ensureGuild(guildId);
  if (ensured.isOk()) return ensured.unwrap();
  throw ensured.error;
}

/** Loads guild feature overrides, throwing on unexpected failure. */
export async function loadGuildFeatures(guildId: string): Promise<GuildFeaturesValue> {
  const result = await getGuildFeatures(guildId);
  if (result.isOk()) return result.unwrap();
  throw result.error;
}

/**
 * Builds a one-row short text input for a Discord modal.
 * `required` controls whether the field blocks modal submission.
 */
export function modalInput(
  customId: string,
  label: string,
  placeholder: string,
  required: boolean,
): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setPlaceholder(placeholder)
      .setRequired(required)
      .setStyle(TextInputStyle.Short),
  );
}

/**
 * Shows a modal with exactly one short text input.
 * Caller must return `false` after this call to suppress the default re-render.
 */
export async function showOneInputModal(
  interaction: { isButton(): boolean; showModal(modal: ModalBuilder): Promise<void> },
  session: PanelState,
  panelId: PanelId,
  action: string,
  title: string,
  customId: string,
  label: string,
  placeholder: string,
): Promise<void> {
  if (!interaction.isButton()) throw new Error("This action must be opened from a button.");
  const modal = new ModalBuilder()
    .setCustomId(makePanelCustomId(session, panelId, action))
    .setTitle(title)
    .addComponents(modalInput(customId, label, placeholder, true));
  await interaction.showModal(modal);
}

/**
 * Shared renderer for simple "choose a field, pick a channel" panels.
 * Used by tickets and offers which follow the identical two-row UX pattern.
 */
export function renderChannelPairPanel(
  session: PanelState,
  panelId: "tickets",
  title: string,
  selectedField: string | undefined,
  fields: readonly { value: string; label: string }[],
  embedFields: APIEmbedField[],
): PanelPayload {
  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, panelId, "field"))
    .setPlaceholder("Choose channel field")
    .addOptions(
      fields.map((field) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(field.label)
          .setValue(field.value)
          .setDefault(selectedField === field.value),
      ),
    );
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, panelId, "set-channel"))
    .setPlaceholder("Set selected channel")
    .setMinValues(1)
    .setMaxValues(1);
  return {
    container: panelContainer({
      title,
      description: `Selected field: **${selectedField ?? "none"}**`,
      fields: embedFields,
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    ],
  };
}

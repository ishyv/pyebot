/**
 * In-memory wizard state and Discord component builders for `/embed`.
 *
 * Durable embed data lives in Mongo. The wizard keeps only short-lived private
 * editing state because Discord component custom IDs are the only state that
 * survives across button/select/modal interactions.
 */
import { randomBytes } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  type ContainerBuilder,
  type MessageActionRowComponentBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { breadcrumb, container, row, separator, text } from "@/ui/v2";
import { EMBED_MAX_FIELDS, EMBED_WIZARD_TTL_MS, SCHEDULE_OPTIONS } from "./config";
import type { EmbedConfigDraft } from "./model";
import { embedRoutes } from "./routes";

export type { EmbedConfigDraft } from "./model";

/** Short-lived edit session for one user's embed wizard. */
export interface EmbedWizardSession {
  readonly id: string;
  readonly ownerId: string;
  readonly guildId: string;
  readonly embedName: string;
  readonly isEdit: boolean;
  createdAt: number;
  updatedAt: number;
  draft: EmbedConfigDraft;
}

/** Parsed session-scoped wizard actions after raw custom IDs have been narrowed once. */
export type EmbedWizardAction =
  | { kind: "open-basic" }
  | { kind: "open-media" }
  | { kind: "open-author" }
  | { kind: "open-footer" }
  | { kind: "open-field-add" }
  | { kind: "open-script" }
  | { kind: "toggle-sticky" }
  | { kind: "toggle-script" }
  | { kind: "remove-last-field" }
  | { kind: "preview" }
  | { kind: "save" }
  | { kind: "cancel" }
  | { kind: "submit-basic" }
  | { kind: "submit-media" }
  | { kind: "submit-author" }
  | { kind: "submit-footer" }
  | { kind: "submit-field-add" }
  | { kind: "submit-script" }
  | { kind: "select-channel" }
  | { kind: "select-schedule" };

/** Payload shape used by V2 wizard panels. */
export interface WizardPanelPayload {
  container: ContainerBuilder;
  actionRows: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** Session store with a fixed TTL so stale private controls cannot mutate config forever. */
export class EmbedWizardRegistry {
  private readonly sessions = new Map<string, EmbedWizardSession>();

  create(
    ownerId: string,
    guildId: string,
    embedName: string,
    draft: EmbedConfigDraft,
    isEdit: boolean,
  ): EmbedWizardSession {
    this.purgeExpired();
    const now = Date.now();
    const session: EmbedWizardSession = {
      id: randomBytes(4).toString("hex"),
      ownerId,
      guildId,
      embedName,
      isEdit,
      createdAt: now,
      updatedAt: now,
      draft,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** Reads an active session and touches `updatedAt`; expired sessions are removed. */
  get(sessionId: string): EmbedWizardSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.createdAt + EMBED_WIZARD_TTL_MS < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    session.updatedAt = Date.now();
    return session;
  }

  /** Removes a wizard session after save/cancel/expiry. */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Clears expired sessions opportunistically before creating new ones. */
  purgeExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.createdAt + EMBED_WIZARD_TTL_MS < now) this.sessions.delete(id);
    }
  }
}

export const embedWizardSessions = new EmbedWizardRegistry();

function truncate(value: string | null | undefined, length: number): string {
  if (!value) return "-";
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function colorHex(color: number | null | undefined): string {
  if (color == null) return "-";
  return `#${color.toString(16).padStart(6, "0").toUpperCase()}`;
}

/** Renders the full embed wizard as one V2 container at Discord's 40-component limit. */
export function renderWizardPanel(session: EmbedWizardSession): WizardPanelPayload {
  const { draft, id } = session;
  const fieldCount = draft.embedFields.length;
  const scheduleValue = draft.scheduleIntervalHours?.toString() ?? "off";

  const panel = container(
    "info",
    breadcrumb("Embed Creator", session.isEdit ? "Edit" : "New", session.embedName),
    text(
      [
        "**Basic**",
        `Title: ${truncate(draft.embedTitle, 40)}`,
        `Description: ${truncate(draft.embedDescription, 40)}`,
        `Color: ${colorHex(draft.embedColor)}`,
      ].join("\n"),
    ),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes["open-basic"].id({ session: id }))
        .setLabel("Edit Basic")
        .setStyle(ButtonStyle.Secondary),
    ),
    separator("sm"),
    text(
      [
        "**Media**",
        `Thumbnail: ${truncate(draft.embedThumbnail, 40)}`,
        `Image: ${truncate(draft.embedImage, 40)}`,
      ].join("\n"),
    ),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes["open-media"].id({ session: id }))
        .setLabel("Edit Media")
        .setStyle(ButtonStyle.Secondary),
    ),
    separator("sm"),
    text(
      [
        "**Author**",
        `Name: ${truncate(draft.embedAuthorName, 40)}`,
        `URL: ${truncate(draft.embedAuthorUrl, 40)}`,
      ].join("\n"),
    ),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes["open-author"].id({ session: id }))
        .setLabel("Edit Author")
        .setStyle(ButtonStyle.Secondary),
    ),
    separator("sm"),
    text(`**Footer**\nText: ${truncate(draft.embedFooterText, 40)}`),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes["open-footer"].id({ session: id }))
        .setLabel("Edit Footer")
        .setStyle(ButtonStyle.Secondary),
    ),
    separator("sm"),
    text(`**Fields**\n${fieldCount}/${EMBED_MAX_FIELDS} fields`),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes["open-field-add"].id({ session: id }))
        .setLabel("Add Field")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(embedRoutes["remove-last-field"].id({ session: id }))
        .setLabel("Remove Last")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(fieldCount === 0),
    ),
    separator("sm"),
    text(
      [
        "**Delivery**",
        `Channel: ${draft.channelId ? `<#${draft.channelId}>` : "not set"}`,
        `Schedule: ${scheduleValue === "off" ? "off" : `every ${scheduleValue}h`}`,
        `Sticky: ${draft.stickyEnabled ? "on" : "off"}`,
      ].join("\n"),
    ),
    row(
      new ChannelSelectMenuBuilder()
        .setCustomId(embedRoutes["select-channel"].id({ session: id }))
        .setPlaceholder("Set delivery channel")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1),
    ),
    row(
      new StringSelectMenuBuilder()
        .setCustomId(embedRoutes["select-schedule"].id({ session: id }))
        .setPlaceholder("Set schedule")
        .addOptions(
          SCHEDULE_OPTIONS.map((option) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setValue(option.value)
              .setDefault(option.value === scheduleValue),
          ),
        ),
    ),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes["toggle-sticky"].id({ session: id }))
        .setLabel(`Sticky: ${draft.stickyEnabled ? "ON" : "OFF"}`)
        .setStyle(draft.stickyEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
    separator("sm"),
    text(
      [
        "**Script**",
        `Enabled: ${draft.scriptEnabled ? "yes" : "no"}`,
        `Script: ${truncate(draft.script, 40)}`,
      ].join("\n"),
    ),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes["open-script"].id({ session: id }))
        .setLabel("Edit Script")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(embedRoutes["toggle-script"].id({ session: id }))
        .setLabel(`Script: ${draft.scriptEnabled ? "ON" : "OFF"}`)
        .setStyle(draft.scriptEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
    separator("sm"),
    row(
      new ButtonBuilder()
        .setCustomId(embedRoutes.preview.id({ session: id }))
        .setLabel("Preview")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(embedRoutes.save.id({ session: id }))
        .setLabel("Save")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(embedRoutes.cancel.id({ session: id }))
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return { container: panel, actionRows: [] };
}

/** Builds the modal that edits title, description, and color. */
export function buildBasicModal(session: EmbedWizardSession): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(embedRoutes["submit-basic"].id({ session: session.id }))
    .setTitle("Basic Settings")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Title")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(false)
          .setValue(session.draft.embedTitle ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Description")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000)
          .setRequired(false)
          .setValue(session.draft.embedDescription ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("color")
          .setLabel("Color (hex, e.g. #5865F2)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(7)
          .setRequired(false)
          .setValue(
            session.draft.embedColor
              ? `#${session.draft.embedColor.toString(16).padStart(6, "0")}`
              : "",
          ),
      ),
    );
}

/** Builds the modal for embed URL, thumbnail, and image URL. */
export function buildMediaModal(session: EmbedWizardSession): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(embedRoutes["submit-media"].id({ session: session.id }))
    .setTitle("Media")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("thumbnail")
          .setLabel("Thumbnail URL")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(session.draft.embedThumbnail ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("image")
          .setLabel("Image URL")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(session.draft.embedImage ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("url")
          .setLabel("Embed URL")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(session.draft.embedUrl ?? ""),
      ),
    );
}

/** Builds the modal for embed author properties. */
export function buildAuthorModal(session: EmbedWizardSession): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(embedRoutes["submit-author"].id({ session: session.id }))
    .setTitle("Author")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Author Name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(false)
          .setValue(session.draft.embedAuthorName ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("iconUrl")
          .setLabel("Author Icon URL")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(session.draft.embedAuthorIconUrl ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("url")
          .setLabel("Author URL")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(session.draft.embedAuthorUrl ?? ""),
      ),
    );
}

/** Builds the modal for footer text and icon URL. */
export function buildFooterModal(session: EmbedWizardSession): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(embedRoutes["submit-footer"].id({ session: session.id }))
    .setTitle("Footer")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("Footer Text")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2048)
          .setRequired(false)
          .setValue(session.draft.embedFooterText ?? ""),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("iconUrl")
          .setLabel("Footer Icon URL")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(session.draft.embedFooterIconUrl ?? ""),
      ),
    );
}

/** Builds the modal for appending one embed field. */
export function buildFieldAddModal(session: EmbedWizardSession): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(embedRoutes["submit-field-add"].id({ session: session.id }))
    .setTitle("Add Field")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Field Name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("value")
          .setLabel("Field Value")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1024)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("inline")
          .setLabel("Inline? (yes/no)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(3)
          .setRequired(false),
      ),
    );
}

/** Builds the modal for the optional admin-authored script function. */
export function buildScriptModal(session: EmbedWizardSession): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(embedRoutes["submit-script"].id({ session: session.id }))
    .setTitle("Script")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("script")
          .setLabel("Script (TypeScript body)")
          .setPlaceholder("return { title: ctx.guild.name };")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000)
          .setRequired(false)
          .setValue(session.draft.script ?? ""),
      ),
    );
}

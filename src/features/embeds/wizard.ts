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

/** Parsed embed component custom ID for direct, list, and session-owned interactions. */
export type EmbedCustomId =
  | { scope: "direct"; action: { kind: "delete"; name: string } | { kind: "cancel" } }
  | { scope: "list"; action: { kind: "edit"; name: string } }
  | { scope: "session"; sessionId: string; action: EmbedWizardAction };

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

/** Encodes a session-scoped custom ID. */
export function wizardId(sessionId: string, action: string): string {
  return `emb:${sessionId}:${action}`;
}

/** Decodes the raw `emb:{scope}:{action}` shape while preserving colons inside action. */
export function parseWizardId(customId: string): { sessionId: string; action: string } | null {
  if (!customId.startsWith("emb:")) return null;
  const rest = customId.slice(4);
  const colonIndex = rest.indexOf(":");
  if (colonIndex === -1) return null;
  const sessionId = rest.slice(0, colonIndex);
  const action = rest.slice(colonIndex + 1);
  if (!sessionId || !action) return null;
  return { sessionId, action };
}

/** Parses every embed custom ID into a small discriminated union for routing. */
export function parseEmbedCustomId(customId: string): EmbedCustomId | null {
  const parsed = parseWizardId(customId);
  if (!parsed) return null;

  if (parsed.sessionId === "direct") {
    if (parsed.action === "cancel") return { scope: "direct", action: { kind: "cancel" } };
    if (parsed.action.startsWith("delete:")) {
      const name = parsed.action.slice("delete:".length);
      return name ? { scope: "direct", action: { kind: "delete", name } } : null;
    }
    return null;
  }

  if (parsed.sessionId === "list") {
    if (!parsed.action.startsWith("edit:")) return null;
    const name = parsed.action.slice("edit:".length);
    return name ? { scope: "list", action: { kind: "edit", name } } : null;
  }

  const action = parseSessionAction(parsed.action);
  return action ? { scope: "session", sessionId: parsed.sessionId, action } : null;
}

function parseSessionAction(action: string): EmbedWizardAction | null {
  switch (action) {
    case "basic-modal":
      return { kind: "open-basic" };
    case "media-modal":
      return { kind: "open-media" };
    case "author-modal":
      return { kind: "open-author" };
    case "footer-modal":
      return { kind: "open-footer" };
    case "field-add-modal":
      return { kind: "open-field-add" };
    case "script-modal":
      return { kind: "open-script" };
    case "sticky-toggle":
      return { kind: "toggle-sticky" };
    case "script-toggle":
      return { kind: "toggle-script" };
    case "field-remove-last":
      return { kind: "remove-last-field" };
    case "preview":
      return { kind: "preview" };
    case "save":
      return { kind: "save" };
    case "cancel":
      return { kind: "cancel" };
    case "basic-submit":
      return { kind: "submit-basic" };
    case "media-submit":
      return { kind: "submit-media" };
    case "author-submit":
      return { kind: "submit-author" };
    case "footer-submit":
      return { kind: "submit-footer" };
    case "field-add-submit":
      return { kind: "submit-field-add" };
    case "script-submit":
      return { kind: "submit-script" };
    case "channel-select":
      return { kind: "select-channel" };
    case "schedule-select":
      return { kind: "select-schedule" };
    default:
      return null;
  }
}

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
        .setCustomId(wizardId(id, "basic-modal"))
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
        .setCustomId(wizardId(id, "media-modal"))
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
        .setCustomId(wizardId(id, "author-modal"))
        .setLabel("Edit Author")
        .setStyle(ButtonStyle.Secondary),
    ),
    separator("sm"),
    text(`**Footer**\nText: ${truncate(draft.embedFooterText, 40)}`),
    row(
      new ButtonBuilder()
        .setCustomId(wizardId(id, "footer-modal"))
        .setLabel("Edit Footer")
        .setStyle(ButtonStyle.Secondary),
    ),
    separator("sm"),
    text(`**Fields**\n${fieldCount}/${EMBED_MAX_FIELDS} fields`),
    row(
      new ButtonBuilder()
        .setCustomId(wizardId(id, "field-add-modal"))
        .setLabel("Add Field")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(wizardId(id, "field-remove-last"))
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
        .setCustomId(wizardId(id, "channel-select"))
        .setPlaceholder("Set delivery channel")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1),
    ),
    row(
      new StringSelectMenuBuilder()
        .setCustomId(wizardId(id, "schedule-select"))
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
        .setCustomId(wizardId(id, "sticky-toggle"))
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
        .setCustomId(wizardId(id, "script-modal"))
        .setLabel("Edit Script")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(wizardId(id, "script-toggle"))
        .setLabel(`Script: ${draft.scriptEnabled ? "ON" : "OFF"}`)
        .setStyle(draft.scriptEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
    separator("sm"),
    row(
      new ButtonBuilder()
        .setCustomId(wizardId(id, "preview"))
        .setLabel("Preview")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(wizardId(id, "save"))
        .setLabel("Save")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(wizardId(id, "cancel"))
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return { container: panel, actionRows: [] };
}

/** Builds the modal that edits title, description, and color. */
export function buildBasicModal(session: EmbedWizardSession): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(wizardId(session.id, "basic-submit"))
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
    .setCustomId(wizardId(session.id, "media-submit"))
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
    .setCustomId(wizardId(session.id, "author-submit"))
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
    .setCustomId(wizardId(session.id, "footer-submit"))
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
    .setCustomId(wizardId(session.id, "field-add-submit"))
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
    .setCustomId(wizardId(session.id, "script-submit"))
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

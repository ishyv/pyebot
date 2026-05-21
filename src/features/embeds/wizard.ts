/**
 * Embed-wizard session registry, custom ID encoding, and the V2 panel renderer.
 *
 * Sessions are keyed by a short random ID that is embedded in every component's
 * customId so incoming interactions can look up the in-memory draft without a
 * DB round-trip.  A fixed TTL (EMBED_WIZARD_TTL_MS) bounds memory use.
 */
import { randomBytes } from "node:crypto";
import {
  type ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  type ContainerBuilder,
  type MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { breadcrumb, container, row, separator, text } from "@/ui/v2";
import { EMBED_MAX_FIELDS, EMBED_WIZARD_TTL_MS, SCHEDULE_OPTIONS } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mutable working copy — everything except tracking fields the DB manages. */
export type EmbedConfigDraft = Omit<
  EmbedConfig,
  | "_id"
  | "guildId"
  | "name"
  | "createdBy"
  | "createdAt"
  | "updatedAt"
  | "stickyMessageId"
  | "stickyLastResendAt"
  | "scheduledNextSendAt"
  | "scheduledLastSentAt"
>;

export interface EmbedWizardSession {
  readonly id: string; // 8-hex chars from crypto.randomBytes(4).toString("hex")
  readonly ownerId: string;
  readonly guildId: string;
  readonly embedName: string; // fixed at creation; used as key on save
  readonly isEdit: boolean; // true if editing an existing embed
  createdAt: number; // Date.now() at creation
  updatedAt: number; // Date.now() on each get() call
  draft: EmbedConfigDraft;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

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

  /**
   * Returns null if not found OR if the session has expired
   * (createdAt + EMBED_WIZARD_TTL_MS < Date.now()).
   * Expired sessions are removed from the map.
   * Touches updatedAt on each successful access.
   */
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

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Removes all sessions where createdAt + TTL < now. Called at the start of create(). */
  purgeExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.createdAt + EMBED_WIZARD_TTL_MS < now) {
        this.sessions.delete(id);
      }
    }
  }
}

export const embedWizardSessions = new EmbedWizardRegistry();

// ---------------------------------------------------------------------------
// Custom ID encoding
// ---------------------------------------------------------------------------

/** Build a wizard custom ID: "emb:{sessionId}:{action}" */
export function wizardId(sessionId: string, action: string): string {
  return `emb:${sessionId}:${action}`;
}

/**
 * Parse a wizard custom ID.
 * Format: "emb:{sessionId}:{action}"
 * Returns null if format is invalid.
 */
export function parseWizardId(customId: string): { sessionId: string; action: string } | null {
  if (!customId.startsWith("emb:")) return null;
  const rest = customId.slice(4); // strip "emb:"
  const colonIndex = rest.indexOf(":");
  if (colonIndex === -1) return null; // no action segment
  const sessionId = rest.slice(0, colonIndex);
  const action = rest.slice(colonIndex + 1);
  if (!sessionId || !action) return null;
  return { sessionId, action };
}

// ---------------------------------------------------------------------------
// Panel renderer
// ---------------------------------------------------------------------------

export interface WizardPanelPayload {
  container: ContainerBuilder;
  actionRows: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function truncate(s: string | null | undefined, len: number): string {
  if (!s) return "—";
  return s.length > len ? `${s.slice(0, len)}…` : s;
}

function colorHex(color: number | null | undefined): string {
  if (color == null) return "—";
  return `#${color.toString(16).padStart(6, "0").toUpperCase()}`;
}

/**
 * Render the full embed-creator wizard panel as a single V2 container.
 * All action rows are embedded as container children; the returned actionRows
 * array is always empty.  Callers send with MessageFlags.IsComponentsV2.
 *
 * Component budget: 40 (V2 hard limit).
 *   container(1) + breadcrumb(1) + 8 sections ≤ 38 remaining → exactly 38.
 */
export function renderWizardPanel(session: EmbedWizardSession): WizardPanelPayload {
  const { draft, id } = session;

  // ── Section 1: Basic ──────────────────────────────────────────────────────
  const basicText = text(
    [
      "**Basic**",
      `Title: ${truncate(draft.embedTitle, 40)}`,
      `Description: ${truncate(draft.embedDescription, 40)}`,
      `Color: ${colorHex(draft.embedColor)}`,
    ].join("\n"),
  );
  const basicRow = row(
    new ButtonBuilder()
      .setCustomId(wizardId(id, "basic-modal"))
      .setLabel("Edit Basic")
      .setStyle(ButtonStyle.Secondary),
  );

  // ── Section 2: Media ──────────────────────────────────────────────────────
  const mediaText = text(
    [
      "**Media**",
      `Thumbnail: ${truncate(draft.embedThumbnail, 40)}`,
      `Image: ${truncate(draft.embedImage, 40)}`,
    ].join("\n"),
  );
  const mediaRow = row(
    new ButtonBuilder()
      .setCustomId(wizardId(id, "media-modal"))
      .setLabel("Edit Media")
      .setStyle(ButtonStyle.Secondary),
  );

  // ── Section 3: Author ─────────────────────────────────────────────────────
  const authorText = text(
    [
      "**Author**",
      `Name: ${truncate(draft.embedAuthorName, 40)}`,
      `URL: ${truncate(draft.embedAuthorUrl, 40)}`,
    ].join("\n"),
  );
  const authorRow = row(
    new ButtonBuilder()
      .setCustomId(wizardId(id, "author-modal"))
      .setLabel("Edit Author")
      .setStyle(ButtonStyle.Secondary),
  );

  // ── Section 4: Footer ─────────────────────────────────────────────────────
  const footerText = text(
    ["**Footer**", `Text: ${truncate(draft.embedFooterText, 40)}`].join("\n"),
  );
  const footerRow = row(
    new ButtonBuilder()
      .setCustomId(wizardId(id, "footer-modal"))
      .setLabel("Edit Footer")
      .setStyle(ButtonStyle.Secondary),
  );

  // ── Section 5: Fields ─────────────────────────────────────────────────────
  const fieldCount = draft.embedFields?.length ?? 0;
  const fieldsText = text(`**Fields**\n${fieldCount}/${EMBED_MAX_FIELDS} fields`);
  const fieldsRow = row(
    new ButtonBuilder()
      .setCustomId(wizardId(id, "field-add-modal"))
      .setLabel("Add Field")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(wizardId(id, "field-remove-last"))
      .setLabel("Remove Last")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(fieldCount === 0),
  );

  // ── Section 6: Delivery ───────────────────────────────────────────────────
  const currentIntervalStr = draft.scheduleIntervalHours?.toString() ?? "off";
  const deliveryText = text(
    [
      "**Delivery**",
      `Channel: ${draft.channelId ? `<#${draft.channelId}>` : "not set"}`,
      `Schedule: ${currentIntervalStr === "off" ? "off" : `every ${currentIntervalStr}h`}`,
      `Sticky: ${draft.stickyEnabled ? "on" : "off"}`,
    ].join("\n"),
  );
  const channelSelectRow = row(
    new ChannelSelectMenuBuilder()
      .setCustomId(wizardId(id, "channel-select"))
      .setPlaceholder("Set delivery channel")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1),
  );
  const scheduleSelectRow = row(
    new StringSelectMenuBuilder()
      .setCustomId(wizardId(id, "schedule-select"))
      .setPlaceholder("Set schedule")
      .addOptions(
        SCHEDULE_OPTIONS.map((opt) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(opt.label)
            .setValue(opt.value)
            .setDefault(opt.value === currentIntervalStr),
        ),
      ),
  );
  const stickyRow = row(
    new ButtonBuilder()
      .setCustomId(wizardId(id, "sticky-toggle"))
      .setLabel(`Sticky: ${draft.stickyEnabled ? "ON" : "OFF"}`)
      .setStyle(draft.stickyEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  // ── Section 7: Script ─────────────────────────────────────────────────────
  const scriptText = text(
    [
      "**Script**",
      `Enabled: ${draft.scriptEnabled ? "yes" : "no"}`,
      `Script: ${truncate(draft.script, 40)}`,
    ].join("\n"),
  );
  const scriptRow = row(
    new ButtonBuilder()
      .setCustomId(wizardId(id, "script-modal"))
      .setLabel("Edit Script")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(wizardId(id, "script-toggle"))
      .setLabel(`Script: ${draft.scriptEnabled ? "ON" : "OFF"}`)
      .setStyle(draft.scriptEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  // ── Section 8: Actions ────────────────────────────────────────────────────
  const actionsRow = row(
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
  );

  // ── Assemble container ────────────────────────────────────────────────────
  // Component budget (V2 limit = 40):
  //   container(1) + breadcrumb(1) +
  //   Basic:    text(1)+sep(1)+row(1+1=2) = 4   → no leading sep before first section
  //   Media:    sep(1)+text(1)+row(1+1=2) = 4
  //   Author:   sep(1)+text(1)+row(1+1=2) = 4
  //   Footer:   sep(1)+text(1)+row(1+1=2) = 4
  //   Fields:   sep(1)+text(1)+row(1+2=3) = 5
  //   Delivery: sep(1)+text(1)+row(1+1)+row(1+1)+row(1+1) = 8
  //   Script:   sep(1)+text(1)+row(1+2=3) = 5
  //   Actions:  sep(1)+row(1+3=4) = 5  (no text for actions to stay within limit)
  //   Total: 1+1 + 4+4+4+4+5+8+5+5 = 41 → trim: no sep before Basic = -1 → 40
  const c = container(
    "info",
    breadcrumb("Embed Creator", session.isEdit ? "Edit" : "New", session.embedName),
    // Basic (no leading separator)
    basicText,
    basicRow,
    // Media
    separator("sm"),
    mediaText,
    mediaRow,
    // Author
    separator("sm"),
    authorText,
    authorRow,
    // Footer
    separator("sm"),
    footerText,
    footerRow,
    // Fields
    separator("sm"),
    fieldsText,
    fieldsRow,
    // Delivery
    separator("sm"),
    deliveryText,
    channelSelectRow,
    scheduleSelectRow,
    stickyRow,
    // Script
    separator("sm"),
    scriptText,
    scriptRow,
    // Actions
    separator("sm"),
    actionsRow,
  );

  return { container: c, actionRows: [] };
}

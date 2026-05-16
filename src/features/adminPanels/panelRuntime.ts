/**
 * Shared runtime for ephemeral admin panel sessions.
 *
 * Discord component custom IDs are the only state that survives a button/select
 * click, so each ID carries a short session key, current panel, and action. The
 * full session stays in memory because these dashboards are private moderator
 * workflows, not durable guild state. A short TTL keeps stale controls from
 * mutating config long after the moderator opened the panel.
 */
import type {
  APIEmbedField,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageActionRowComponentBuilder,
  MessageCreateOptions,
  MessageEditOptions,
} from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ContainerBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import type { AccentKey } from "@/ui/theme";
import { container, separator, text } from "@/ui/v2";

export const PANEL_PREFIX = "panel:";

/** Admin panel sessions are intentionally short-lived and in-memory only. */
export const PANEL_TTL_MS = 5 * 60_000;

export const PANEL_DEFINITIONS = [
  { id: "home", label: "Dashboard", description: "Server-wide status and shortcuts" },
  { id: "channels", label: "Channels", description: "Core channels and managed channel map" },
  { id: "features", label: "Features", description: "Guild feature flags" },
  {
    id: "feature-config",
    label: "Feature Config",
    description: "Feature-owned configurable fields",
  },
  {
    id: "moderation",
    label: "Moderation",
    description: "Logs, escalation, quarantine, verification",
  },
  { id: "automod", label: "Automod", description: "Spam, raid, slowmode, patterns" },
  { id: "new-users", label: "New Users", description: "Recently joined role and limits" },
  { id: "roles", label: "Roles", description: "Moderation permissions, limits, performance" },
  { id: "autoroles", label: "Autoroles", description: "Automatic role rules" },
  { id: "tickets", label: "Tickets", description: "Ticket channels and category" },
  { id: "ai", label: "AI", description: "Provider, model, rate limits" },
  { id: "offers", label: "Offers", description: "Review and approved offer channels" },
  { id: "economy", label: "Economy", description: "Rewards, tax, sectors, feature flags" },
  { id: "reputation", label: "Reputation", description: "Keywords and request flow" },
  { id: "forums", label: "Forums", description: "Forum auto-reply targets" },
  { id: "tops", label: "Tops", description: "Activity report destination and cadence" },
] as const;

export type PanelId = (typeof PANEL_DEFINITIONS)[number]["id"];

export interface PanelState {
  readonly id: string;
  readonly ownerId: string;
  readonly guildId: string;
  panelId: PanelId;
  createdAt: number;
  updatedAt: number;
  selectedChannelSlot?: string;
  pendingManagedChannelId?: string;
  selectedAutomodSection?: string;
  selectedModerationField?: string;
  selectedTicketField?: string;
  selectedOfferField?: string;
  selectedFeatureConfigId?: string;
  selectedFeatureConfigField?: string;
  selectedRoleIds: string[];
  selectedRoleAction: string;
  selectedNewUsersSection?: string;
  selectedNewUsersRuleKind?: string;
  selectedNewUsersScopeIds: string[];
  selectedNewUsersAccessMode: "view" | "send";
}

export interface PanelCustomId {
  sessionId: string;
  panelId: PanelId;
  action: string;
}

/**
 * A rendered admin panel: one V2 Container carrying the panel body plus zero or
 * more action rows for field selects, channel selects, and navigation controls.
 *
 * `withNavigationRows` appends the nav select + refresh/close buttons to
 * `actionRows` before the payload is sent. Callers should never add nav rows
 * themselves; call `withNavigationRows(session, rawPayload)` instead.
 */
export interface PanelPayload {
  container: ContainerBuilder;
  actionRows: PanelActionRow[];
}

export type PanelActionRow = ActionRowBuilder<MessageActionRowComponentBuilder>;

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class PanelSessionRegistry {
  private readonly sessions = new Map<string, PanelState>();

  create(ownerId: string, guildId: string, panelId: PanelId): PanelState {
    this.purgeExpired();
    const now = Date.now();
    const session: PanelState = {
      id: randomId(),
      ownerId,
      guildId,
      panelId,
      createdAt: now,
      updatedAt: now,
      selectedRoleIds: [],
      selectedRoleAction: "timeout",
      selectedNewUsersScopeIds: [],
      selectedNewUsersAccessMode: "send",
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): PanelState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() - session.updatedAt > PANEL_TTL_MS) {
      this.sessions.delete(sessionId);
      return null;
    }
    session.updatedAt = Date.now();
    return session;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }

  size(): number {
    this.purgeExpired();
    return this.sessions.size;
  }

  purgeExpired(now = Date.now()): void {
    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt > PANEL_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}

export const panelSessions = new PanelSessionRegistry();

export function isPanelId(value: string): value is PanelId {
  return PANEL_DEFINITIONS.some((panel) => panel.id === value);
}

export function makePanelCustomId(session: PanelState, panelId: PanelId, action: string): string {
  return `${PANEL_PREFIX}${session.id}:${panelId}:${action}`;
}

/**
 * Decode the compact Discord custom ID format used by every admin control.
 * Actions may contain additional colons, so only the first two segments after
 * the session key are structural.
 */
export function parsePanelCustomId(customId: string): PanelCustomId | null {
  if (!customId.startsWith(PANEL_PREFIX)) return null;
  const rest = customId.slice(PANEL_PREFIX.length);
  const [sessionId, panelId, ...actionParts] = rest.split(":");
  if (!sessionId || !panelId || !actionParts.length || !isPanelId(panelId)) return null;
  return { sessionId, panelId, action: actionParts.join(":") };
}

/**
 * Builds a V2 Container for an admin panel body.
 *
 * Fields are rendered as a text block rather than embed fields, because V2
 * has no inline-field concept. The `inline` property on `APIEmbedField` is
 * accepted but ignored so callers don't need to be updated.
 *
 * Replaces the old `panelEmbed()` factory.
 */
export function panelContainer(params: {
  title: string;
  description?: string;
  accent?: AccentKey;
  fields?: APIEmbedField[];
  footer?: string;
}): ContainerBuilder {
  const headLines: string[] = [`## ${params.title}`];
  if (params.description) headLines.push("", params.description);

  const children: Parameters<typeof container>[1][] = [text(headLines.join("\n"))];

  if (params.fields?.length) {
    const fieldLines = params.fields.map((f) => `**${f.name}:** ${f.value}`);
    children.push(separator("sm"), text(fieldLines.join("\n")));
  }

  if (params.footer) {
    children.push(separator("sm"), text(`-# ${params.footer}`));
  }

  return container(params.accent ?? "info", ...children);
}

export function navigationRows(session: PanelState): PanelActionRow[] {
  const nav = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, session.panelId, "nav"))
    .setPlaceholder("Jump to a panel")
    .addOptions(
      PANEL_DEFINITIONS.map((panel) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(panel.label)
          .setDescription(panel.description)
          .setValue(panel.id)
          .setDefault(panel.id === session.panelId),
      ),
    );

  const refresh = new ButtonBuilder()
    .setCustomId(makePanelCustomId(session, session.panelId, "refresh"))
    .setLabel("Refresh")
    .setStyle(ButtonStyle.Secondary);

  const close = new ButtonBuilder()
    .setCustomId(makePanelCustomId(session, session.panelId, "close"))
    .setLabel("Close")
    .setStyle(ButtonStyle.Danger);

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(nav),
    new ActionRowBuilder<ButtonBuilder>().addComponents(refresh, close),
  ];
}

/**
 * Merges body action rows with the nav select + refresh/close buttons.
 *
 * The total action-row count is capped at `maxRows` (default 5). Body rows
 * come first; nav rows fill remaining slots. When the body already fills all
 * slots, nav is dropped — a concession to Discord's limit; prefer panels with
 * ≤ 3 body rows so both the body controls and nav are always visible.
 */
export function withNavigationRows(
  session: PanelState,
  payload: PanelPayload,
  maxRows = 5,
): PanelPayload {
  const navRows = navigationRows(session);
  const bodyRows = payload.actionRows.slice(0, maxRows);
  const remainingRows = Math.max(0, maxRows - bodyRows.length);
  return {
    container: payload.container,
    actionRows: [...bodyRows, ...navRows.slice(0, remainingRows)],
  };
}

export function commandPanelReply(payload: PanelPayload): InteractionReplyOptions {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: V2 top-level ContainerBuilder is valid at runtime but not yet reflected in discord.js InteractionReplyOptions types.
    components: [payload.container, ...payload.actionRows] as any,
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };
}

export async function respondToPanelCommand(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  if (interaction.deferred) {
    const { flags: _flags, ...editPayload } = payload;
    await interaction.editReply(editPayload);
    return;
  }

  if (interaction.replied) {
    await interaction.followUp(payload);
    return;
  }

  await interaction.reply(payload);
}

export async function updatePanelMessage(
  interaction: ComponentInteraction,
  payload: PanelPayload,
): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not yet in MessageEditOptions types.
  const options: MessageEditOptions & MessageCreateOptions = {
    components: [payload.container, ...payload.actionRows] as any,
    flags: MessageFlags.IsComponentsV2,
  };

  if (!interaction.isModalSubmit() && "update" in interaction) {
    await interaction.update(options);
    return;
  }

  // Modal submits cannot use interaction.update(), so edit the original panel
  // message after acknowledging the modal interaction.
  if (!interaction.deferred && !interaction.replied && "deferUpdate" in interaction) {
    await interaction.deferUpdate();
  }

  const message = ("message" in interaction ? interaction.message : null) as Message | null;
  if (message) {
    await message.edit(options);
  }
}

export async function replyPanelError(
  interaction: ComponentInteraction,
  content: string,
): Promise<void> {
  const payload: InteractionReplyOptions = { content, flags: MessageFlags.Ephemeral };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

export async function openPanelFromCommand(
  interaction: ChatInputCommandInteraction,
  panelId: PanelId,
  render: (session: PanelState) => Promise<PanelPayload>,
): Promise<void> {
  if (!interaction.guildId) {
    await respondToPanelCommand(interaction, {
      content: "This panel can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const session = panelSessions.create(interaction.user.id, interaction.guildId, panelId);
  const payload = await render(session);
  await respondToPanelCommand(interaction, commandPanelReply(payload));
}

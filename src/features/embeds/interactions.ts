import {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { createLogger, type Logger } from "@/core/logger";
import {
  deleteEmbedConfig,
  embedConfigId,
  findStickyForChannel,
  getEmbedConfig,
  saveEmbedConfig,
} from "@/db/repositories/embeds";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import type { BoundComponentHandler } from "@/framework/types";
import { EMBED_MAX_FIELDS } from "./config";
import {
  configFromDraft,
  draftFromConfig,
  parseEmbedColor,
  parseOptionalUrl,
  parseScheduleValue,
} from "./model";
import {
  deferEphemeral,
  editDeferredEmbed,
  editDeferredText,
  modalUpdatePanel,
  replacePanelWithStatus,
  replyEphemeralPanel,
  replyEphemeralText,
  updatePanel,
} from "./responses";
import { buildEmbed } from "./service";
import {
  buildAuthorModal,
  buildBasicModal,
  buildFieldAddModal,
  buildFooterModal,
  buildMediaModal,
  buildScriptModal,
  type EmbedWizardAction,
  type EmbedWizardRegistry,
  type EmbedWizardSession,
  embedWizardSessions,
  renderWizardPanel,
} from "./wizard";

const log = createLogger("embeds:interactions");

type ComponentInteraction = Parameters<BoundComponentHandler>[0];

/** Repository/runtime boundary for wizard interactions, kept injectable for behavior tests. */
export interface EmbedInteractionDeps {
  readonly sessions: EmbedWizardRegistry;
  getEmbedConfig(
    guildId: string,
    name: string,
  ): Promise<{ isErr(): boolean; unwrap(): EmbedConfig | null }>;
  findStickyForChannel(
    guildId: string,
    channelId: string,
  ): Promise<{ isErr(): boolean; unwrap(): EmbedConfig | null }>;
  saveEmbedConfig(config: EmbedConfig): Promise<{ isErr(): boolean }>;
  deleteEmbedConfig(id: string): Promise<{ isErr(): boolean }>;
  invalidateSticky(guildId: string, channelId: string): void;
  readonly log: Pick<Logger, "error" | "warn">;
  now(): Date;
}

/** Builds the live repository/runtime deps for embed interactions. */
export function makeEmbedDeps(
  invalidateSticky: (guildId: string, channelId: string) => void,
): EmbedInteractionDeps {
  return {
    sessions: embedWizardSessions,
    getEmbedConfig,
    findStickyForChannel,
    saveEmbedConfig,
    deleteEmbedConfig,
    invalidateSticky,
    log,
    now: () => new Date(),
  };
}

/**
 * Resolves a wizard session by id (with owner check) and dispatches one decoded
 * action. The customId is parsed by the route layer; this is the shared body
 * behind every session-scoped route handler.
 */
export async function runSessionAction(
  interaction: ComponentInteraction,
  sessionId: string,
  action: EmbedWizardAction,
  deps: EmbedInteractionDeps,
): Promise<void> {
  const session = deps.sessions.get(sessionId);
  if (!session) {
    await replyEphemeralText(interaction, "Wizard session expired. Run `/embed` again.");
    return;
  }
  if (session.ownerId !== interaction.user.id) {
    await replyEphemeralText(interaction, "This wizard belongs to another user.");
    return;
  }
  await handleSessionAction(interaction, session, action, deps);
}

export async function handleDirectAction(
  interaction: ComponentInteraction,
  action: { kind: "delete"; name: string } | { kind: "cancel" },
  deps: EmbedInteractionDeps,
): Promise<void> {
  if (!(interaction instanceof ButtonInteraction) || !interaction.guildId) return;
  if (action.kind === "cancel") {
    await replacePanelWithStatus(interaction, "Cancelled.");
    return;
  }

  const existingRes = await deps.getEmbedConfig(interaction.guildId, action.name);
  if (existingRes.isErr()) {
    await replacePanelWithStatus(interaction, "Failed to fetch embed before delete.", "danger");
    return;
  }
  const existing = existingRes.unwrap();
  const deleteRes = await deps.deleteEmbedConfig(embedConfigId(interaction.guildId, action.name));
  if (deleteRes.isErr()) {
    await replacePanelWithStatus(interaction, "Failed to delete embed.", "danger");
    return;
  }
  if (existing?.channelId) deps.invalidateSticky(interaction.guildId, existing.channelId);
  await replacePanelWithStatus(interaction, `Embed \`${action.name}\` deleted.`, "ok");
}

export async function openEditWizard(
  interaction: ButtonInteraction,
  name: string,
  deps: EmbedInteractionDeps,
): Promise<void> {
  if (!interaction.guildId) return;
  const res = await deps.getEmbedConfig(interaction.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(interaction, "Failed to fetch embed.");
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await replyEphemeralText(interaction, `No embed named \`${name}\` found.`);
    return;
  }
  const session = deps.sessions.create(
    interaction.user.id,
    interaction.guildId,
    name,
    draftFromConfig(config),
    true,
  );
  await replyEphemeralPanel(interaction, renderWizardPanel(session).container);
}

async function handleSessionAction(
  interaction: ComponentInteraction,
  session: EmbedWizardSession,
  action: EmbedWizardAction,
  deps: EmbedInteractionDeps,
): Promise<void> {
  if (interaction instanceof ButtonInteraction) {
    await handleButtonAction(interaction, session, action, deps);
    return;
  }
  if (interaction instanceof ModalSubmitInteraction) {
    await handleModalAction(interaction, session, action);
    return;
  }
  if (interaction instanceof ChannelSelectMenuInteraction && action.kind === "select-channel") {
    session.draft.channelId = interaction.values[0] ?? null;
    await updatePanel(interaction, renderWizardPanel(session).container);
    return;
  }
  if (interaction instanceof StringSelectMenuInteraction && action.kind === "select-schedule") {
    const schedule = parseScheduleValue(interaction.values[0] ?? "off");
    if (schedule) Object.assign(session.draft, schedule);
    await updatePanel(interaction, renderWizardPanel(session).container);
  }
}

async function handleButtonAction(
  interaction: ButtonInteraction,
  session: EmbedWizardSession,
  action: EmbedWizardAction,
  deps: EmbedInteractionDeps,
): Promise<void> {
  switch (action.kind) {
    case "open-basic":
      await interaction.showModal(buildBasicModal(session));
      return;
    case "open-media":
      await interaction.showModal(buildMediaModal(session));
      return;
    case "open-author":
      await interaction.showModal(buildAuthorModal(session));
      return;
    case "open-footer":
      await interaction.showModal(buildFooterModal(session));
      return;
    case "open-field-add":
      await interaction.showModal(buildFieldAddModal(session));
      return;
    case "open-script":
      await interaction.showModal(buildScriptModal(session));
      return;
    case "toggle-sticky":
      session.draft.stickyEnabled = !session.draft.stickyEnabled;
      await updatePanel(interaction, renderWizardPanel(session).container);
      return;
    case "toggle-script":
      session.draft.scriptEnabled = !session.draft.scriptEnabled;
      await updatePanel(interaction, renderWizardPanel(session).container);
      return;
    case "remove-last-field":
      session.draft.embedFields = session.draft.embedFields.slice(0, -1);
      await updatePanel(interaction, renderWizardPanel(session).container);
      return;
    case "preview":
      await previewDraft(interaction, session, deps);
      return;
    case "save":
      await saveDraft(interaction, session, deps);
      return;
    case "cancel":
      deps.sessions.delete(session.id);
      await replacePanelWithStatus(interaction, "Cancelled.");
      return;
  }
}

async function handleModalAction(
  interaction: ModalSubmitInteraction,
  session: EmbedWizardSession,
  action: EmbedWizardAction,
): Promise<void> {
  switch (action.kind) {
    case "submit-basic": {
      session.draft.embedTitle = interaction.fields.getTextInputValue("title").trim() || null;
      session.draft.embedDescription =
        interaction.fields.getTextInputValue("description").trim() || null;
      session.draft.embedColor = parseEmbedColor(interaction.fields.getTextInputValue("color"));
      break;
    }
    case "submit-media":
      session.draft.embedThumbnail = parseOptionalUrl(
        interaction.fields.getTextInputValue("thumbnail"),
      );
      session.draft.embedImage = parseOptionalUrl(interaction.fields.getTextInputValue("image"));
      session.draft.embedUrl = parseOptionalUrl(interaction.fields.getTextInputValue("url"));
      break;
    case "submit-author":
      session.draft.embedAuthorName = interaction.fields.getTextInputValue("name").trim() || null;
      session.draft.embedAuthorIconUrl = parseOptionalUrl(
        interaction.fields.getTextInputValue("iconUrl"),
      );
      session.draft.embedAuthorUrl = parseOptionalUrl(interaction.fields.getTextInputValue("url"));
      break;
    case "submit-footer":
      session.draft.embedFooterText = interaction.fields.getTextInputValue("text").trim() || null;
      session.draft.embedFooterIconUrl = parseOptionalUrl(
        interaction.fields.getTextInputValue("iconUrl"),
      );
      break;
    case "submit-field-add": {
      const name = interaction.fields.getTextInputValue("name").trim();
      const value = interaction.fields.getTextInputValue("value").trim();
      const inlineRaw = interaction.fields.getTextInputValue("inline").trim().toLowerCase();
      if (name && value && session.draft.embedFields.length < EMBED_MAX_FIELDS) {
        session.draft.embedFields = [
          ...session.draft.embedFields,
          { name, value, inline: inlineRaw === "yes" || inlineRaw === "true" },
        ];
      }
      break;
    }
    case "submit-script":
      session.draft.script = interaction.fields.getTextInputValue("script").trim() || null;
      break;
    default:
      return;
  }
  await modalUpdatePanel(interaction, renderWizardPanel(session).container);
}

async function previewDraft(
  interaction: ButtonInteraction,
  session: EmbedWizardSession,
  deps: EmbedInteractionDeps,
): Promise<void> {
  if (!interaction.guild) {
    await replyEphemeralText(interaction, "Preview is only available in a server.");
    return;
  }
  await deferEphemeral(interaction);
  try {
    const channel = interaction.channel ?? { id: interaction.channelId ?? "0", name: "channel" };
    const embed = await buildEmbed(
      configFromDraft(session, null, deps.now()),
      { id: channel.id, name: "name" in channel ? (channel as { name: string }).name : "channel" },
      {
        id: interaction.guild.id,
        name: interaction.guild.name,
        memberCount: interaction.guild.memberCount,
      },
    );
    await editDeferredEmbed(interaction, embed);
  } catch (error) {
    deps.log.error("Failed to preview embed", error);
    await editDeferredText(interaction, "Failed to build preview.");
  }
}

async function saveDraft(
  interaction: ButtonInteraction,
  session: EmbedWizardSession,
  deps: EmbedInteractionDeps,
): Promise<void> {
  if (!interaction.guildId) return;
  if (!session.draft.channelId) {
    await replyEphemeralText(interaction, "Set a target channel before saving.");
    return;
  }

  const previousRes = session.isEdit
    ? await deps.getEmbedConfig(interaction.guildId, session.embedName)
    : null;
  if (previousRes?.isErr()) {
    await replyEphemeralText(interaction, "Failed to fetch existing embed before save.");
    return;
  }
  const previous = previousRes?.unwrap() ?? null;

  if (session.draft.stickyEnabled) {
    const stickyRes = await deps.findStickyForChannel(interaction.guildId, session.draft.channelId);
    if (stickyRes.isErr()) {
      await replyEphemeralText(interaction, "Could not verify sticky status. Please try again.");
      return;
    }
    const existingSticky = stickyRes.unwrap();
    if (
      existingSticky &&
      existingSticky._id !== embedConfigId(interaction.guildId, session.embedName)
    ) {
      await replyEphemeralText(
        interaction,
        "Another embed is already sticky in that channel. Disable it first.",
      );
      return;
    }
  }

  const next = configFromDraft(session, previous, deps.now());
  const saveRes = await deps.saveEmbedConfig(next);
  if (saveRes.isErr()) {
    await replyEphemeralText(interaction, "Failed to save embed.");
    return;
  }

  if (previous?.channelId) deps.invalidateSticky(interaction.guildId, previous.channelId);
  deps.invalidateSticky(interaction.guildId, session.draft.channelId);
  deps.sessions.delete(session.id);
  await replacePanelWithStatus(interaction, `Embed \`${session.embedName}\` saved.`, "ok");
}

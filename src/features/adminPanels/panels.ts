/**
 * Admin panel public API.
 *
 * Owns the three functions consumed by commands and the interaction handler.
 * All rendering and action logic lives in `panels/` via `panelDispatcher.ts`.
 *
 * Re-exports preserve backward-compatibility for tests and commands that
 * import directly from this file.
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import { dispatchPanelAction, renderPanelBody } from "./panelDispatcher";
import { loadGuildConfig } from "./panelHelpers";
import {
  openPanelFromCommand,
  type PanelPayload,
  type PanelState,
  panelContainer,
  panelSessions,
  parsePanelCustomId,
  replyPanelError,
  respondToPanelCommand,
  updatePanelMessage,
  withNavigationRows,
} from "./panelRuntime";

// ---------------------------------------------------------------------------
// Re-exports kept for test and command import stability
// ---------------------------------------------------------------------------
export { render as renderAutomodPanel } from "./panels/automod";
export {
  action as applyFeatureConfigAction,
  render as renderFeatureConfigPanel,
} from "./panels/featureConfig";
export { parseReputationKeywords } from "./panels/reputation";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks that the calling member has Manage Server permission.
 * Returns `false` and replies with an error if not.
 */
export async function assertPanelPermission(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const member = interaction.member;
  const allowed =
    member && typeof member.permissions !== "string" && member.permissions.has("ManageGuild");
  if (!allowed) {
    await respondToPanelCommand(interaction, {
      content: "You need Manage Server permission to use admin panels.",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

/** Opens an admin panel from a slash command interaction. */
export async function openAdminPanel(
  interaction: ChatInputCommandInteraction,
  panelId: Parameters<typeof openPanelFromCommand>[1],
): Promise<void> {
  await openPanelFromCommand(interaction, panelId, renderPanel);
}

/**
 * Loads guild config and renders the full panel payload (body + nav rows).
 * Called both on initial open and after every action that requests a re-render.
 */
export async function renderPanel(session: PanelState): Promise<PanelPayload> {
  const cfg = await loadGuildConfig(session.guildId);
  const body = await renderPanelBody(session, cfg);
  return withNavigationRows(session, body);
}

/**
 * Routes an incoming component or modal interaction through the session guard,
 * the close handler, and then the panel-specific action dispatcher.
 */
export async function handlePanelInteraction(interaction: ComponentInteraction): Promise<void> {
  const parsed = parsePanelCustomId(interaction.customId);
  if (!parsed) return;

  const session = panelSessions.get(parsed.sessionId);
  if (!session) {
    await replyPanelError(
      interaction,
      "This admin panel expired. Open it again with `/dashboard`.",
    );
    return;
  }
  if (session.ownerId !== interaction.user.id) {
    await replyPanelError(interaction, "This panel belongs to another moderator.");
    return;
  }
  if (interaction.guildId && interaction.guildId !== session.guildId) {
    await replyPanelError(interaction, "This panel belongs to another server.");
    return;
  }

  if (parsed.action === "close") {
    panelSessions.delete(session.id);
    await updatePanelMessage(interaction, {
      container: panelContainer({ title: "Panel closed", accent: "mute" }),
      actionRows: [],
    });
    return;
  }

  // nav action updates the session's active panel then falls through to re-render
  if (parsed.action === "nav" && interaction.isStringSelectMenu()) {
    const next = interaction.values[0];
    if (next) session.panelId = next as typeof session.panelId;
    await updatePanelMessage(interaction, await renderPanel(session));
    return;
  }

  if (parsed.action === "refresh") {
    await updatePanelMessage(interaction, await renderPanel(session));
    return;
  }

  try {
    const shouldRender = await dispatchPanelAction(
      interaction,
      session,
      parsed.panelId,
      parsed.action,
    );
    if (!shouldRender) return;
    await updatePanelMessage(interaction, await renderPanel(session));
  } catch (error) {
    await replyPanelError(interaction, error instanceof Error ? error.message : String(error));
  }
}

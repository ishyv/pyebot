/**
 * Central panel dispatch table.
 *
 * Maps every PanelId to its render and action functions. Adding a new panel
 * means adding one entry here and one file under `panels/`. Nothing else.
 *
 * Invariant: render and action stay co-located per panel module. Splitting
 * those into separate registries makes it too easy to add controls that no
 * action handler understands, or action strings that no UI can produce.
 */
import type { ComponentInteraction } from "@/core/feature";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import type { PanelId, PanelPayload, PanelState } from "./panelRuntime";
import * as ai from "./panels/ai";
import * as automod from "./panels/automod";
import * as autoroles from "./panels/autoroles";
import * as channels from "./panels/channels";
import * as economy from "./panels/economy";
import * as featureConfig from "./panels/featureConfig";
import * as features from "./panels/features";
import * as forums from "./panels/forums";
import * as home from "./panels/home";
import * as moderation from "./panels/moderation";
import * as newUsers from "./panels/newUsers";
import * as offers from "./panels/offers";
import * as reputation from "./panels/reputation";
import * as roles from "./panels/roles";
import * as tickets from "./panels/tickets";
import * as tops from "./panels/tops";

export interface PanelHandler {
  render(session: PanelState, cfg: GuildConfig): PanelPayload | Promise<PanelPayload>;
  action(
    interaction: ComponentInteraction,
    session: PanelState,
    actionStr: string,
  ): Promise<boolean>;
}

/** One entry per PanelId. Render and action must stay co-located. */
const PANEL_HANDLERS: Record<PanelId, PanelHandler> = {
  home,
  channels,
  features,
  "feature-config": featureConfig,
  moderation,
  automod,
  "new-users": newUsers,
  roles,
  autoroles,
  tickets,
  offers,
  ai,
  economy,
  reputation,
  forums,
  tops,
};

/**
 * Renders the body of the given panel using the dispatch table.
 * Falls back to the home panel if the id is somehow unmapped.
 */
export function renderPanelBody(
  session: PanelState,
  cfg: GuildConfig,
): PanelPayload | Promise<PanelPayload> {
  return (PANEL_HANDLERS[session.panelId] ?? PANEL_HANDLERS.home).render(session, cfg);
}

/**
 * Routes a component or modal interaction to the appropriate panel action handler.
 * Returns `true` when the caller should re-render, `false` when the panel already
 * responded (e.g. after showing a modal).
 *
 * The caller has already parsed and authorized the session. This function only
 * dispatches within the current in-memory panel state.
 */
export function dispatchPanelAction(
  interaction: ComponentInteraction,
  session: PanelState,
  panelId: PanelId,
  actionStr: string,
): Promise<boolean> {
  return (PANEL_HANDLERS[panelId] ?? PANEL_HANDLERS.home).action(interaction, session, actionStr);
}

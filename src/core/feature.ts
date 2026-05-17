/**
 * Legacy command middleware context shared by pre-framework commands.
 *
 * The active decorated runtime lives in `src/framework`. This module remains
 * only for middleware and admin-panel handlers that still need a small common
 * interaction/context vocabulary while they migrate.
 */

import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  MentionableSelectMenuInteraction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import type { InteractionResponder } from "@/core/interactionResponder";
import type { Result } from "@/core/result";
import type { Guild } from "@/db/schemas/guild";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Shared context threaded through the middleware pipeline and into execute().
 * Built once per interaction by the dispatcher — no command fetches guild config itself.
 */
export interface CommandContext {
  readonly guildId: string;
  readonly userId: string;
  readonly commandName: string;
  readonly featureId: string;
  /** Guild document fetched once per interaction; use this instead of calling getGuild() in commands. */
  readonly guildConfig: Guild;
  /** Framework-owned Discord interaction response lifecycle. */
  readonly respond: InteractionResponder;
}

/**
 * A middleware function in the pre-execute pipeline.
 *
 * Return Ok(undefined) to continue. Return Err({ content }) to short-circuit:
 * the dispatcher will reply with that content (ephemeral by default) and stop.
 */
export type MiddlewareFn = (
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
) => Promise<Result<void, { content: string; ephemeral?: boolean }>>;

// ---------------------------------------------------------------------------
// Component interactions (buttons, select menus, modals)
// ---------------------------------------------------------------------------

/** Discord component/modal interactions handled by legacy admin-panel routing. */
export type ComponentInteraction =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | MentionableSelectMenuInteraction
  | RoleSelectMenuInteraction
  | UserSelectMenuInteraction
  | ModalSubmitInteraction;

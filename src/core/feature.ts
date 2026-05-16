/**
 * Compiled feature runtime contract.
 *
 * Public bot authors write decorated classes from `src/framework`. Bootstrap
 * compiles those classes into this explicit runtime shape so dispatch,
 * lifecycle, feature gates, and admin config can stay simple and inspectable.
 */

import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  Client,
  MentionableSelectMenuInteraction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import type { FeatureConfigDefinition } from "@/core/featureConfig";
import type { InteractionResponder, InteractionVisibility } from "@/core/interactionResponder";
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
// Commands
// ---------------------------------------------------------------------------

export interface FeatureCommand {
  /** Slash command data with .name and .toJSON(). */
  readonly data: { name: string; toJSON(): unknown };
  readonly execute: (
    interaction: ChatInputCommandInteraction,
    ctx: CommandContext,
  ) => Promise<void>;
  readonly response?: {
    readonly defer?: "immediate" | "none";
    readonly visibility: InteractionVisibility;
  };
  /**
   * Command-specific middleware (cooldowns, permission checks).
   * Runs AFTER the framework-level guildOnly and featureGate middleware.
   */
  readonly middleware?: readonly MiddlewareFn[];
}

// ---------------------------------------------------------------------------
// Component handlers (buttons, select menus, modals)
// ---------------------------------------------------------------------------

export type ComponentInteraction =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | MentionableSelectMenuInteraction
  | RoleSelectMenuInteraction
  | UserSelectMenuInteraction
  | ModalSubmitInteraction;

export interface ComponentHandler {
  /** Human-readable prefix for logging and docs (e.g. "tickets:close:"). */
  readonly prefix: string;
  /** Returns true if this handler owns the given customId. */
  readonly matches: (customId: string) => boolean;
  readonly handle: (interaction: ComponentInteraction) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Event registrations
// ---------------------------------------------------------------------------

export interface EventRegistration {
  /** The Discord.js client event name (e.g. "guildMemberAdd"). */
  readonly event: string;
  /** Called with the client during bootstrap. Use client.on() inside. */
  readonly register: (client: Client) => void;
}

// ---------------------------------------------------------------------------
// Declarative feature metadata
// ---------------------------------------------------------------------------

export interface FeatureCapabilities {
  readonly discordIntents?: readonly string[];
}

// ---------------------------------------------------------------------------
// Compiled feature
// ---------------------------------------------------------------------------

export interface RuntimeFeature {
  /**
   * Unique identifier. Used as the namespace for logging and bus subscriptions.
   * Convention: lowercase, no spaces (e.g. "economy", "rpg", "tickets").
   */
  readonly id: string;

  /**
   * If set, commands and components from this feature are gated by guild.features[featureGate].
   * If the guild has that key set to false, the dispatcher short-circuits with "Feature disabled."
   * Omit for features that are always available (e.g. moderation).
   */
  readonly featureGate?: string;

  /** Optional dashboard-editable guild config declared by the feature owner. */
  readonly config?: FeatureConfigDefinition;

  /** Optional operational requirements that admin tools can surface. */
  readonly capabilities?: FeatureCapabilities;

  readonly commands: readonly FeatureCommand[];
  readonly components?: readonly ComponentHandler[];
  readonly events?: readonly EventRegistration[];

  /**
   * Called after MongoDB connects and content packs load, before the Discord client logs in.
   * Use for: subscribing to bus events, starting intervals, any async setup.
   */
  readonly onLoad?: () => Promise<void> | void;

  /**
   * Called after the Discord client emits "clientReady".
   * Use for: actions that require the live client (e.g. scheduling jobs with guild data).
   */
  readonly onReady?: (client: Client) => Promise<void> | void;

  /**
   * Called during SIGINT/SIGTERM before the process exits.
   * Use for: clearing intervals, flushing state, closing connections owned by the feature.
   */
  readonly onShutdown?: () => Promise<void> | void;
}

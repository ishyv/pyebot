/**
 * Feature module contract.
 *
 * Each feature exports a plain FeatureModule object from its index.ts.
 * The framework wires everything: commands get uploaded, interactions get routed,
 * feature gates get enforced. No base classes, no decorators.
 *
 * See docs/features.md for the full guide. Minimal example:
 *
 * ```ts
 * // src/features/polls/index.ts
 * import type { FeatureModule } from "@/core/feature";
 * import * as pollCmd from "./commands/poll";
 *
 * const polls: FeatureModule = {
 *   id: "polls",
 *   featureGate: "polls",
 *   commands: [{ data: pollCmd.data, execute: pollCmd.execute }],
 * };
 * export default polls;
 * ```
 *
 * Then one line in src/features/manifest.ts:
 * ```ts
 * () => import("@/features/polls/index").then((m) => m.default),
 * ```
 */

import type {
  Client,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  MentionableSelectMenuInteraction,
  RoleSelectMenuInteraction,
  UserSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import type { Result } from "@/core/result";
import type { Guild } from "@/db/schemas/guild";
import type { FeatureConfigDefinition } from "@/core/featureConfig";

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
  /** SlashCommandBuilder (or compatible) with .name and .toJSON(). */
  readonly data: { name: string; toJSON(): unknown };
  readonly execute: (interaction: ChatInputCommandInteraction, ctx: CommandContext) => Promise<void>;
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
// Feature module
// ---------------------------------------------------------------------------

export interface FeatureModule {
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
   * Called after the Discord client emits "ready".
   * Use for: actions that require the live client (e.g. scheduling jobs with guild data).
   */
  readonly onReady?: (client: Client) => Promise<void> | void;

  /**
   * Called during SIGINT/SIGTERM before the process exits.
   * Use for: clearing intervals, flushing state, closing connections owned by the feature.
   */
  readonly onShutdown?: () => Promise<void> | void;
}

/**
 * Foundational types for the tx framework.
 *
 * Everything in `src/framework/*` references this file. It contains no runtime
 * code — only the type vocabulary that lets the framework speak about features,
 * components, commands, and the data-access surface (`Ctx`) without circular
 * imports.
 *
 * Why this file exists rather than scattering these types where they're used:
 * a single source of truth is easier to evolve, and it prevents the framework
 * primitives (component, world, decorators, etc.) from importing each other for
 * type-only reasons. Every primitive only depends on types.ts plus its own
 * implementation needs.
 */

import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Interaction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import type { Collection, Document, Filter, FindOptions } from "mongodb";
import type { ZodType } from "zod";
import type { Logger } from "@/core/logger";
import type { CooldownManager, LockSet, SessionManager } from "@/core/state";

// ─── Entity ─────────────────────────────────────────────────────────────────

/**
 * An Entity is just a string — almost always a Discord snowflake (user id,
 * guild id, channel id). The framework deliberately does NOT manage entity
 * lifecycles or generate ids: Discord already provides globally unique,
 * monotonically generated identifiers, and reusing them eliminates an entire
 * class of bookkeeping that traditional ECS frameworks need.
 *
 * If a feature ever needs a synthetic id (e.g. a market listing id, a ticket
 * id), it should still be a string — generated with a uuid or a monotonic
 * counter — so the same Ctx APIs work uniformly.
 */
export type Entity = string;

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * A Component is a typed descriptor — never an instance — that pairs a
 * MongoDB collection name with a Zod schema describing the documents in that
 * collection. It is created via `component()` (see component.ts).
 *
 * The Component carries TWO pieces of information the World needs at runtime:
 *   1. `collection`: which MongoDB collection holds the documents.
 *   2. `schema`:     how to validate / default a document on read.
 *
 * Plus a phantom marker (`__t`) that exists ONLY at the type level so
 * TypeScript can infer the document shape from any `Component<T>` reference.
 */
export interface Component<T> {
  readonly collection: string;
  readonly schema: ZodType<T>;
  /** Phantom marker — never read at runtime. Lets TS recover `T` from a Component reference. */
  readonly __t?: T;
}

/** Convenience: a component value with its `_id` attached (as returned by `ctx.query`). */
export type ComponentRecord<T> = T & { _id: Entity };

// ─── Events ────────────────────────────────────────────────────────────────

/**
 * Any class usable as an event. We use class constructors themselves as the
 * routing keys for the event bus — see event-bus.ts and decorators.ts for the
 * "constructor-as-token" pattern.
 */
export type EventConstructor<E = unknown> = new (...args: never[]) => E;

/** Handler signature for `@On(EventClass)` methods. */
export type EventHandler<E> = (event: E, ctx: Ctx) => void | Promise<void>;

// ─── Commands ──────────────────────────────────────────────────────────────

/** Help metadata that cannot be derived from Discord's slash-command builder. */
export type CommandHelp =
  | false
  | {
      readonly hints?: readonly string[];
      readonly requires?: string;
    };

/**
 * What every file in a feature's `commands/` folder must export by default.
 *
 * - `data`: a slash-command builder (or anything with a `name` and `toJSON()`).
 * - `help`: curated help metadata, or `false` to opt out of `/help`.
 * - `execute`: the actual handler. The framework injects a `Ctx` after the
 *    interaction so features never construct one themselves.
 * - `autocomplete` (optional): for slash-command option autocomplete.
 *
 * Loader rejects files in `commands/` that do not match this shape — silent
 * skipping would mask typos.
 */
export interface CommandModule {
  readonly data: { name: string; toJSON(): unknown };
  readonly help: CommandHelp;
  execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, ctx: Ctx): Promise<void>;
}

// ─── Component (button/select) handlers ────────────────────────────────────

/** What `@Handle("prefix:")` produces under the hood. */
export interface ComponentRoute {
  /** The customId prefix this route matches (e.g. "trivia:" or "features:toggle:"). */
  readonly prefix: string;
  /** The method name on the handlers class — used only by the framework loader. */
  readonly methodKey: string;
}

/** A bound component handler ready to be invoked by the router. */
export type BoundComponentHandler = (
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  ctx: Ctx,
) => Promise<void>;

// ─── Feature manifest ──────────────────────────────────────────────────────

/**
 * The pure-metadata shape every feature's `index.ts` exports via `defineFeature`.
 *
 * Notice what is NOT here: commands and handlers are NOT listed — they are
 * auto-discovered from the feature's folder by the loader. Listing them
 * manually would be tedious and easy to forget.
 */
export interface FeatureDescriptor {
  /** Stable identifier — used as collection prefix, /features sub-command, and toggle key. */
  readonly id: string;
  /** Human-readable name shown in /features panel. */
  readonly name: string;
  /** One-line description shown in /features panel. */
  readonly description: string;
  /**
   * Whether the feature is enabled by default for guilds that have not toggled it.
   * Override per-guild via the GuildFeatures component.
   */
  readonly defaultEnabled?: boolean;
}

/**
 * What `loadFeatures()` produces for each discovered feature folder. The
 * loader attaches the auto-discovered commands and handler class to the
 * developer-authored descriptor.
 */
export interface LoadedFeature {
  readonly descriptor: FeatureDescriptor;
  /** Auto-discovered command modules from `<feature>/commands/*.ts`. */
  readonly commands: ReadonlyArray<CommandModule>;
  /** Optional handler-class instance (one per feature) with @On/@Handle methods. */
  readonly handlers: object | null;
}

// ─── Ctx ────────────────────────────────────────────────────────────────────

/**
 * The data-and-runtime surface every command and handler receives. This is
 * the ONLY abstraction features should reach for to read/write data, emit
 * events, or access shared singletons. No store imports, no repository
 * imports, no `register(client)` calls.
 *
 * A `Ctx` is produced per interaction (`world.forInteraction(...)`) so the
 * request-scoped cache and per-feature logger context live with the request
 * and are garbage-collected with it.
 */
export interface Ctx {
  // -- Component access ---------------------------------------------------

  /** Read a component for an entity. Returns null if no document exists. */
  get<T>(id: Entity, component: Component<T>): Promise<T | null>;

  /**
   * Read-or-create. Returns the parsed component. If the document does not
   * exist, a default instance (from the schema's defaults) is upserted and
   * returned. Subsequent calls within the same interaction hit the cache.
   */
  ensure<T>(id: Entity, component: Component<T>): Promise<T>;

  /** Replace the document wholesale. Use sparingly — prefer patch. */
  set<T>(id: Entity, component: Component<T>, value: T): Promise<void>;

  /**
   * Partial update. Pass either a partial object, or a function that receives
   * the current value and returns the partial. The function variant is the
   * preferred form for any "read-then-modify" sequence — it guarantees the
   * cache stays in sync with the write.
   */
  patch<T>(
    id: Entity,
    component: Component<T>,
    patch: Partial<T> | ((current: T) => Partial<T>),
  ): Promise<void>;

  /** Delete the document. */
  delete<T>(id: Entity, component: Component<T>): Promise<void>;

  /**
   * Cross-entity query against a component's collection. The leaderboard
   * escape hatch — every "top N by X" use case lives here. Returns the
   * parsed component values plus their `_id`.
   */
  query<T>(
    component: Component<T>,
    options?: { filter?: Filter<Document>; sort?: Record<string, 1 | -1>; limit?: number; skip?: number },
  ): Promise<ReadonlyArray<ComponentRecord<T>>>;

  // -- Events -------------------------------------------------------------

  /**
   * Emit an event. Listeners registered via `@On(EventClass)` run
   * synchronously and sequentially, in feature-load order. Events emitted
   * inside a listener are queued and dispatched after the current cycle
   * completes — no nested re-entry.
   */
  emit<E>(event: E): Promise<void>;

  // -- Discord + framework primitives -------------------------------------

  /** The Discord.js client. Use for things the higher-level Ctx APIs don't cover yet. */
  readonly client: Client;
  /** Logger tagged with the calling feature's id (or "framework" for non-feature code). */
  readonly logger: Logger;
  /** Shared cooldown manager — same singleton as before. */
  readonly cooldowns: CooldownManager;
  /** Shared lock set — for things like fight-state exclusivity. */
  readonly locks: LockSet;
  /** Shared in-memory session store (trivia rounds, etc.). */
  readonly sessions: SessionManager<unknown>;
  /** The originating interaction (if this Ctx was made for one). May be null for offline jobs. */
  readonly interaction: Interaction | null;
}

// ─── Raw MongoDB access (escape hatch for World/internals only) ────────────

/**
 * Used by the World implementation and migration scripts. Feature code should
 * never touch raw collections — that's the whole point of the Component
 * abstraction.
 */
export interface RawCollectionAccess {
  collection<T extends Document & { _id: Entity }>(name: string): Promise<Collection<T>>;
}

export type { Filter, FindOptions };

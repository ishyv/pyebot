import {
  type APIApplicationCommandOptionChoice,
  type ApplicationCommandOptionAllowedChannelTypes,
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from "discord.js";
import type { Result } from "@/core/result";
import { container, text, v2Message } from "@/ui/v2";
import { parseDuration } from "@/utils/duration";
import type { CommandContract, CommandHelp, CommandModule, Ctx } from "./types";

type DeferVisibility = "ephemeral" | "public";
type CommandResponse = Parameters<Ctx["respond"]["send"]>[0];

/** Scope for a declarative `.cooldown()` — determines which ID the cooldown key is keyed to. */
export type CooldownScope = "user" | "guild" | "channel" | "global";

interface CooldownSpec {
  readonly durationMs: number;
  readonly scope: CooldownScope;
}
type MaybePromise<T> = T | Promise<T>;
type ErrorConstructor<E extends Error = Error> = new (...args: never[]) => E;
type CommandPermissions = Parameters<SlashCommandBuilder["setDefaultMemberPermissions"]>[0];

type OptionKind =
  | "string"
  | "integer"
  | "boolean"
  | "user"
  | "channel"
  | "role"
  | "mentionable"
  | "attachment";

interface OptionDefinition {
  readonly kind: OptionKind;
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
  readonly autocomplete?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly choices?: readonly APIApplicationCommandOptionChoice<string | number>[];
  readonly channelTypes?: readonly ApplicationCommandOptionAllowedChannelTypes[];
  readonly children?: readonly OptionDefinition[];
}

interface SubcommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly options: readonly OptionDefinition[];
}

interface GroupDefinition {
  readonly name: string;
  readonly description: string;
  readonly subcommands: readonly SubcommandDefinition[];
}

interface SlashOptionJson {
  readonly type?: number;
  readonly name?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly autocomplete?: boolean;
  readonly min_value?: number;
  readonly max_value?: number;
  readonly min_length?: number;
  readonly max_length?: number;
  readonly choices?: readonly APIApplicationCommandOptionChoice<string | number>[];
  readonly options?: readonly SlashOptionJson[];
}

interface CommandContextBase {
  readonly interaction: ChatInputCommandInteraction;
  readonly ctx: Ctx;
  readonly user: ChatInputCommandInteraction["user"];
  readonly userId: string;
  readonly guild: ChatInputCommandInteraction["guild"];
  readonly guildId: string | null;
  readonly member: ChatInputCommandInteraction["member"];
  readonly options: Readonly<Record<string, unknown>>;
  readonly subcommand: string | null;
  readonly subcommandGroup: string | null;
  expect<T, E>(result: Result<T, E>): T;
  /**
   * Unwrap a Result or short-circuit `.run()` with a mapped error response.
   * If the result is `Err`, throws a sentinel that `execute()` catches and
   * sends as the command response — no explicit `if (result.isErr()) return`
   * needed at the call site.
   */
  unwrap<T, E>(result: Result<T, E>, mapErr: (e: E) => CommandResponse): T;
  /** Unwrap a Result or silently return `fallback` on failure. */
  unwrapOr<T>(result: Result<T, unknown>, fallback: T): T;
  /** Build a success (green) v2 container response. */
  ok(markdown: string): CommandResponse;
  /** Build a danger (red) v2 container response. */
  fail(markdown: string): CommandResponse;
  /** Build an info (blue) v2 container response. */
  info(markdown: string): CommandResponse;
  /** Build a muted (grey) v2 container response. */
  warn(markdown: string): CommandResponse;
}

// biome-ignore lint/suspicious/noConfusingVoidType: Command handlers may respond directly and intentionally return nothing.
type RunHandler = (context: CommandContextBase) => MaybePromise<CommandResponse | void>;
type CatchHandler<E extends Error> = (
  error: E,
  context: CommandContextBase,
  // biome-ignore lint/suspicious/noConfusingVoidType: Error mappers may decline to handle by returning nothing.
) => MaybePromise<CommandResponse | void>;

interface CatchEntry {
  readonly errorClass: ErrorConstructor;
  readonly handler: CatchHandler<Error>;
}

// ─── Type-level accumulated builder state ───────────────────────────────────

/** Marker the option overloads use to detect `{ required: true }` at the call site. */
type RequiredSettings = { required: true };

/** Non-null value types for entity options, derived from the Discord.js resolver. */
type EntityOptionValue = {
  readonly user: NonNullable<ReturnType<ChatInputCommandInteraction["options"]["getUser"]>>;
  readonly channel: NonNullable<ReturnType<ChatInputCommandInteraction["options"]["getChannel"]>>;
  readonly role: NonNullable<ReturnType<ChatInputCommandInteraction["options"]["getRole"]>>;
  readonly mentionable: NonNullable<
    ReturnType<ChatInputCommandInteraction["options"]["getMentionable"]>
  >;
  readonly attachment: NonNullable<
    ReturnType<ChatInputCommandInteraction["options"]["getAttachment"]>
  >;
};

type OptionRecord = Record<string, unknown>;

/** One declared subcommand: its group (or null), name, and option value shape. */
interface SubcommandState {
  readonly group: string | null;
  readonly name: string;
  readonly opts: OptionRecord;
}

/** Accumulated compile-time state threaded through the builder type. */
export interface DslState {
  readonly opts: OptionRecord;
  readonly subs: SubcommandState;
  readonly guild: boolean;
}

type InitialDslState = { opts: Record<string, never>; subs: never; guild: false };

type WithOpt<S extends DslState, N extends string, V> = {
  opts: S["opts"] & { readonly [P in N]: V };
  subs: S["subs"];
  guild: S["guild"];
};
type WithSub<S extends DslState, Sub extends SubcommandState> = {
  opts: S["opts"];
  subs: S["subs"] | Sub;
  guild: S["guild"];
};
type WithGuild<S extends DslState> = { opts: S["opts"]; subs: S["subs"]; guild: true };

/** A subcommand declared inside a group, before its group name is attached. */
interface GroupSubState {
  readonly name: string;
  readonly opts: OptionRecord;
}
type AttachGroup<N extends string, GS extends GroupSubState> = GS extends GroupSubState
  ? { group: N; name: GS["name"]; opts: GS["opts"] }
  : never;

// ─── Run context (public, typed) ────────────────────────────────────────────

interface CommandContextCore {
  readonly interaction: ChatInputCommandInteraction;
  readonly ctx: Ctx;
  readonly user: ChatInputCommandInteraction["user"];
  readonly userId: string;
  expect<T, E>(result: Result<T, E>): T;
  /**
   * Unwrap a Result or short-circuit `.run()` with a mapped error response.
   * If the result is `Err`, throws a sentinel that `execute()` catches and
   * sends as the command response — no explicit `if (result.isErr()) return`
   * needed at the call site.
   */
  unwrap<T, E>(result: Result<T, E>, mapErr: (e: E) => CommandResponse): T;
  /** Unwrap a Result or silently return `fallback` on failure. */
  unwrapOr<T>(result: Result<T, unknown>, fallback: T): T;
  /** Build a success (green) v2 container response. */
  ok(markdown: string): CommandResponse;
  /** Build a danger (red) v2 container response. */
  fail(markdown: string): CommandResponse;
  /** Build an info (blue) v2 container response. */
  info(markdown: string): CommandResponse;
  /** Build a muted (grey) v2 container response. */
  warn(markdown: string): CommandResponse;
}
type GuildContextFields<S extends DslState> = S["guild"] extends true
  ? {
      readonly guild: NonNullable<ChatInputCommandInteraction["guild"]>;
      readonly guildId: string;
      readonly member: NonNullable<ChatInputCommandInteraction["member"]>;
    }
  : {
      readonly guild: ChatInputCommandInteraction["guild"];
      readonly guildId: string | null;
      readonly member: ChatInputCommandInteraction["member"];
    };
type SubcommandContextFields<Subs extends SubcommandState> = Subs extends SubcommandState
  ? {
      readonly subcommandGroup: Subs["group"];
      readonly subcommand: Subs["name"];
      readonly options: Readonly<Subs["opts"]>;
    }
  : never;
type OptionContextFields<S extends DslState> = [S["subs"]] extends [never]
  ? {
      readonly subcommand: null;
      readonly subcommandGroup: null;
      readonly options: Readonly<S["opts"]>;
    }
  : SubcommandContextFields<S["subs"]>;

/** The fully-typed context an authored `.run(...)` handler receives. */
export type RunContextFor<S extends DslState> = CommandContextCore &
  GuildContextFields<S> &
  OptionContextFields<S>;

/**
 * Context for a `.handle()` callback declared inside `CommandGroupDsl`.
 *
 * The guild fields are loosely typed (nullable) because the group builder does
 * not carry the parent command's guildOnly flag. Options are narrowed to exactly
 * the subcommand matched by `N`.
 */
type GroupRunContext<GS extends GroupSubState, N extends string> = CommandContextCore & {
  readonly guild: ChatInputCommandInteraction["guild"];
  readonly guildId: string | null;
  readonly member: ChatInputCommandInteraction["member"];
  readonly subcommand: N;
  readonly subcommandGroup: string;
  readonly options: Readonly<Extract<GS, { name: N }>["opts"]>;
};

/** Extracts the run context from a built command, e.g. `RunContext<typeof data>`. */
export type RunContext<C> = C extends CommandDsl<infer S> ? RunContextFor<S> : never;

type RunContextHandler<S extends DslState> = (
  context: RunContextFor<S>,
  // biome-ignore lint/suspicious/noConfusingVoidType: Handlers may respond directly and return nothing.
) => MaybePromise<CommandResponse | void>;
type CatchContextHandler<S extends DslState, E extends Error> = (
  error: E,
  context: RunContextFor<S>,
  // biome-ignore lint/suspicious/noConfusingVoidType: Error mappers may decline to handle by returning nothing.
) => MaybePromise<CommandResponse | void>;

/**
 * Fluent command authoring surface for slash command shape and lifecycle.
 *
 * The builder is generic over its accumulated `DslState`: every option,
 * subcommand, group, and `guildOnly()` call refines the state so the
 * `.run(...)` handler receives a fully-typed, discriminated run context. The
 * object produced is still the internal `CommandModule` shape the
 * loader/bootstrap consume. Feature authors should use this DSL instead of
 * constructing Discord builders directly.
 */
export interface CommandDsl<S extends DslState = DslState> {
  readonly data: CommandModule["data"];
  readonly name: string;
  readonly requiresAdmin?: boolean;
  readonly contract: CommandContract;
  execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void>;

  description(description: string): CommandDsl<S>;
  help(help: Exclude<CommandHelp, false>): CommandDsl<S>;
  hidden(): CommandDsl<S>;
  adminOnly(): CommandDsl<S>;
  guildOnly(): CommandDsl<WithGuild<S>>;
  defer(visibility: DeferVisibility | false): CommandDsl<S>;
  /**
   * Declare a cooldown for this command.
   *
   * The framework checks the cooldown BEFORE calling `.run()`. If it fires, the
   * user gets an ephemeral "You can use this again <t:timestamp:R>" message and
   * the handler is not invoked. On a successful (non-throwing) handler return,
   * the cooldown is recorded.
   *
   * @param duration  Milliseconds or a human string: `"24h"`, `"30m"`, `"7d"`.
   * @param scope     Which ID keys the cooldown. Defaults to `"user"`.
   *                  Stacking multiple `.cooldown()` calls is supported.
   *
   * @example
   * command("daily")
   *   .cooldown("24h")                 // per user
   *   .cooldown("1h", "guild")         // also per guild
   *   .run(async (c) => { ... });
   */
  cooldown(duration: number | string, scope?: CooldownScope): CommandDsl<S>;
  defaultMemberPermissions(permissions: CommandPermissions): CommandDsl<S>;
  dmPermission(enabled: boolean): CommandDsl<S>;

  // Typed options. The first overload matches `{ required: true }` and yields a
  // non-null value type; the second is the optional/default form.
  string<N extends string>(
    name: N,
    description: string,
    options: StringOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, string>>;
  string<N extends string>(
    name: N,
    description: string,
    options?: StringOptionSettings,
  ): CommandDsl<WithOpt<S, N, string | null>>;
  integer<N extends string>(
    name: N,
    description: string,
    options: IntegerOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, number>>;
  integer<N extends string>(
    name: N,
    description: string,
    options?: IntegerOptionSettings,
  ): CommandDsl<WithOpt<S, N, number | null>>;
  boolean<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, boolean>>;
  boolean<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandDsl<WithOpt<S, N, boolean | null>>;
  user<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["user"]>>;
  user<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["user"] | null>>;
  channel<N extends string>(
    name: N,
    description: string,
    options: ChannelOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["channel"]>>;
  channel<N extends string>(
    name: N,
    description: string,
    options?: ChannelOptionSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["channel"] | null>>;
  role<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["role"]>>;
  role<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["role"] | null>>;
  mentionable<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["mentionable"]>>;
  mentionable<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["mentionable"] | null>>;
  attachment<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["attachment"]>>;
  attachment<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandDsl<WithOpt<S, N, EntityOptionValue["attachment"] | null>>;

  subcommand<N extends string, O extends OptionRecord = Record<string, never>>(
    name: N,
    description: string,
    build?: (sub: CommandOptionDsl) => CommandOptionDsl<O>,
  ): CommandDsl<WithSub<S, { group: null; name: N; opts: O }>>;
  group<N extends string, GS extends GroupSubState>(
    name: N,
    description: string,
    build: (group: CommandGroupDsl) => CommandGroupDsl<GS>,
  ): CommandDsl<WithSub<S, AttachGroup<N, GS>>>;

  autocomplete(handler: NonNullable<CommandModule["autocomplete"]>): CommandDsl<S>;
  autocomplete(interaction: AutocompleteInteraction, ctx: Ctx): Promise<void>;
  /**
   * Register an inline handler for a specific top-level subcommand.
   *
   * The handler receives a narrowed run context: `c.options` is typed to exactly
   * the options declared for `name`, and `c.subcommandGroup` is `null`.
   * `.handle()` is additive — the `.run()` fallback still fires for any
   * subcommand that does NOT have an inline handler.
   *
   * @example
   * command("warn")
   *   .subcommand("add", "...", s => s.user("user", ...).string("reason", ...))
   *   .handle("add", async (c) => {
   *     const { user, reason } = c.options; // fully typed
   *   })
   */
  handle<N extends Extract<S["subs"], { group: null }>["name"]>(
    name: N,
    handler: (
      c: Extract<RunContextFor<S>, { subcommand: N; subcommandGroup: null }>,
    ) => MaybePromise<CommandResponse | void>,
  ): CommandDsl<S>;
  run(handler: RunContextHandler<S>): CommandDsl<S>;
  catch<E extends Error>(
    errorClass: ErrorConstructor<E>,
    handler: CatchContextHandler<S, E>,
  ): CommandDsl<S>;
  /**
   * Pipe this builder through a factory function.
   * Useful for extracting shared option groups into named, reusable functions
   * without breaking the builder chain.
   *
   * @example
   * const withTarget = (s: CommandDsl<S>) => s.user("user", "Target", { required: true });
   * command("ban").build(withTarget).string("reason", ...).run(...);
   */
  build<NS extends DslState>(factory: (s: CommandDsl<S>) => CommandDsl<NS>): CommandDsl<NS>;
}

/** Shared settings for any slash command option. */
export interface BaseOptionSettings {
  readonly required?: boolean;
}

/** Settings for string slash command options. */
export interface StringOptionSettings extends BaseOptionSettings {
  readonly autocomplete?: boolean;
  readonly choices?: readonly APIApplicationCommandOptionChoice<string>[];
  readonly min?: number;
  readonly max?: number;
}

/** Settings for integer slash command options. */
export interface IntegerOptionSettings extends BaseOptionSettings {
  readonly autocomplete?: boolean;
  readonly choices?: readonly APIApplicationCommandOptionChoice<number>[];
  readonly min?: number;
  readonly max?: number;
}

/** Settings for channel slash command options. */
export interface ChannelOptionSettings extends BaseOptionSettings {
  readonly channelTypes?: readonly ApplicationCommandOptionAllowedChannelTypes[];
}

/** Option builder used inside a subcommand declaration; accumulates option types. */
export interface CommandOptionDsl<O extends OptionRecord = Record<string, never>> {
  string<N extends string>(
    name: N,
    description: string,
    options: StringOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: string }>;
  string<N extends string>(
    name: N,
    description: string,
    options?: StringOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: string | null }>;
  integer<N extends string>(
    name: N,
    description: string,
    options: IntegerOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: number }>;
  integer<N extends string>(
    name: N,
    description: string,
    options?: IntegerOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: number | null }>;
  boolean<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: boolean }>;
  boolean<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: boolean | null }>;
  user<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["user"] }>;
  user<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["user"] | null }>;
  channel<N extends string>(
    name: N,
    description: string,
    options: ChannelOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["channel"] }>;
  channel<N extends string>(
    name: N,
    description: string,
    options?: ChannelOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["channel"] | null }>;
  role<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["role"] }>;
  role<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["role"] | null }>;
  mentionable<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["mentionable"] }>;
  mentionable<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["mentionable"] | null }>;
  attachment<N extends string>(
    name: N,
    description: string,
    options: BaseOptionSettings & RequiredSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["attachment"] }>;
  attachment<N extends string>(
    name: N,
    description: string,
    options?: BaseOptionSettings,
  ): CommandOptionDsl<O & { readonly [P in N]: EntityOptionValue["attachment"] | null }>;
  /**
   * Pipe this option builder through a factory function.
   * Useful for extracting shared subcommand option shapes into named, reusable functions.
   *
   * @example
   * const withTarget = (s: CommandOptionDsl) => s.user("user", "Target", { required: true });
   * .subcommand("ban", "Ban", (s) => s.build(withTarget).string("reason", ...))
   */
  build<NO extends OptionRecord>(
    factory: (s: CommandOptionDsl<O>) => CommandOptionDsl<NO>,
  ): CommandOptionDsl<NO>;
}

/** Subcommand group builder used by `command(...).group(...)`; accumulates subcommands. */
export interface CommandGroupDsl<GS extends GroupSubState = never> {
  subcommand<N extends string, O extends OptionRecord = Record<string, never>>(
    name: N,
    description: string,
    build?: (sub: CommandOptionDsl) => CommandOptionDsl<O>,
  ): CommandGroupDsl<GS | { name: N; opts: O }>;
  /**
   * Register an inline handler for a specific subcommand within this group.
   *
   * `c.options` is typed to exactly the options declared for `name`.
   * Guild fields are loosely typed (nullable) because the group builder does
   * not carry the parent command's guildOnly constraint.
   *
   * @example
   * .group("escalation", "...", g =>
   *   g
   *     .subcommand("add", "...", s => s.integer("warns", ...).string("action", ...))
   *     .handle("add", async (c) => {
   *       const { warns, action } = c.options; // fully typed
   *     })
   * )
   */
  handle<N extends GS["name"]>(
    name: N,
    handler: (c: GroupRunContext<GS, N>) => MaybePromise<CommandResponse | void>,
  ): CommandGroupDsl<GS>;
}

/**
 * Thrown by `c.unwrap()` to short-circuit `.run()` with a mapped response.
 * Caught in `CommandBuilder.execute()` before the normal `.catch()` handlers
 * so it never surfaces as an unhandled error.
 */
class ResponseSentinel {
  constructor(readonly response: CommandResponse) {}
}

/**
 * Creates a framework command DSL builder.
 *
 * The builder owns Discord slash-command construction while returning the
 * same runtime module shape the existing loader/bootstrap already understand.
 */
export function command(name: string): CommandDsl<InitialDslState> {
  return new CommandBuilder(name) as unknown as CommandDsl<InitialDslState>;
}

class OptionListBuilder {
  readonly options: OptionDefinition[] = [];

  string(name: string, description: string, options: StringOptionSettings = {}): this {
    return this.add({ kind: "string", name, description, ...options });
  }

  integer(name: string, description: string, options: IntegerOptionSettings = {}): this {
    return this.add({ kind: "integer", name, description, ...options });
  }

  boolean(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.add({ kind: "boolean", name, description, ...options });
  }

  user(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.add({ kind: "user", name, description, ...options });
  }

  channel(name: string, description: string, options: ChannelOptionSettings = {}): this {
    return this.add({ kind: "channel", name, description, ...options });
  }

  role(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.add({ kind: "role", name, description, ...options });
  }

  mentionable(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.add({ kind: "mentionable", name, description, ...options });
  }

  attachment(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.add({ kind: "attachment", name, description, ...options });
  }

  build(factory: (self: OptionListBuilder) => OptionListBuilder): OptionListBuilder {
    return factory(this);
  }

  private add(option: OptionDefinition): this {
    this.options.push(option);
    return this;
  }
}

class GroupBuilder {
  readonly subcommands: SubcommandDefinition[] = [];
  readonly subHandlers: Map<string, RunHandler> = new Map();

  subcommand(
    name: string,
    description: string,
    build: (sub: OptionListBuilder) => OptionListBuilder = (sub) => sub,
  ): this {
    const sub = new OptionListBuilder();
    build(sub);
    this.subcommands.push({ name, description, options: sub.options });
    return this;
  }

  handle(name: string, handler: RunHandler): this {
    this.subHandlers.set(name, handler);
    return this;
  }
}

class CommandBuilder {
  readonly data: SlashCommandBuilder;
  private readonly contractState: {
    dsl: true;
    guildOnly: boolean;
    defer: CommandContract["defer"];
  } = {
    dsl: true,
    guildOnly: false,
    defer: false,
  };
  help: CommandHelp | ((help: Exclude<CommandHelp, false>) => this) = ((
    help: Exclude<CommandHelp, false>,
  ) => {
    this.help = help;
    return this;
  }) as never;
  requiresAdmin?: boolean;
  private readonly options: OptionDefinition[] = [];
  private readonly subcommands: SubcommandDefinition[] = [];
  private readonly groups: GroupDefinition[] = [];
  private deferVisibility: DeferVisibility | false = false;
  private requireGuild = false;
  private runHandler: RunHandler | null = null;
  private autocompleteDeclared = false;
  autocomplete:
    | CommandModule["autocomplete"]
    | ((handler: NonNullable<CommandModule["autocomplete"]>) => this) = ((
    handler: NonNullable<CommandModule["autocomplete"]>,
  ) => {
    this.autocompleteDeclared = true;
    this.autocomplete = handler;
    return this;
  }) as never;
  private readonly catchHandlers: CatchEntry[] = [];
  private readonly subHandlers: Map<string, RunHandler> = new Map();
  private readonly cooldownSpecs: CooldownSpec[] = [];

  constructor(name: string) {
    this.data = new SlashCommandBuilder().setName(name).setDescription(name);
  }

  get name(): string {
    return this.data.name;
  }

  get contract(): CommandContract {
    return this.contractState;
  }

  description(description: string): this {
    this.data.setDescription(description);
    return this;
  }

  hidden(): this {
    this.help = false;
    return this;
  }

  adminOnly(): this {
    this.requiresAdmin = true;
    return this;
  }

  guildOnly(): this {
    this.requireGuild = true;
    this.contractState.guildOnly = true;
    this.data.setDMPermission(false);
    return this;
  }

  defer(visibility: DeferVisibility | false): this {
    this.deferVisibility = visibility;
    this.contractState.defer = visibility;
    return this;
  }

  cooldown(duration: number | string, scope: CooldownScope = "user"): this {
    const durationMs =
      typeof duration === "number"
        ? duration
        : parseDuration(duration);
    if (durationMs === null || durationMs <= 0) {
      throw new Error(
        `Invalid cooldown duration "${duration}". Use a positive number (ms) or a string like "24h", "30m", "7d".`,
      );
    }
    this.cooldownSpecs.push({ durationMs, scope });
    return this;
  }

  defaultMemberPermissions(permissions: CommandPermissions): this {
    this.data.setDefaultMemberPermissions(permissions);
    return this;
  }

  dmPermission(enabled: boolean): this {
    this.data.setDMPermission(enabled);
    return this;
  }

  string(name: string, description: string, options: StringOptionSettings = {}): this {
    return this.addOption({ kind: "string", name, description, ...options });
  }

  integer(name: string, description: string, options: IntegerOptionSettings = {}): this {
    return this.addOption({ kind: "integer", name, description, ...options });
  }

  boolean(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.addOption({ kind: "boolean", name, description, ...options });
  }

  user(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.addOption({ kind: "user", name, description, ...options });
  }

  channel(name: string, description: string, options: ChannelOptionSettings = {}): this {
    return this.addOption({ kind: "channel", name, description, ...options });
  }

  role(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.addOption({ kind: "role", name, description, ...options });
  }

  mentionable(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.addOption({ kind: "mentionable", name, description, ...options });
  }

  attachment(name: string, description: string, options: BaseOptionSettings = {}): this {
    return this.addOption({ kind: "attachment", name, description, ...options });
  }

  subcommand(
    name: string,
    description: string,
    build: (sub: OptionListBuilder) => OptionListBuilder = (sub) => sub,
  ): this {
    const sub = new OptionListBuilder();
    build(sub);
    const definition = { name, description, options: sub.options };
    this.subcommands.push(definition);
    this.data.addSubcommand((builder) => applySubcommand(builder, definition));
    return this;
  }

  group(name: string, description: string, build: (group: GroupBuilder) => GroupBuilder): this {
    const group = new GroupBuilder();
    build(group);
    const definition = { name, description, subcommands: group.subcommands };
    this.groups.push(definition);
    // Merge inline group subcommand handlers with a "group:sub" key prefix.
    for (const [subName, handler] of group.subHandlers) {
      this.subHandlers.set(`${name}:${subName}`, handler);
    }
    this.data.addSubcommandGroup((builder) => {
      builder.setName(name).setDescription(description);
      for (const sub of definition.subcommands)
        builder.addSubcommand((entry) => applySubcommand(entry, sub));
      return builder;
    });
    return this;
  }

  handle(name: string, handler: RunHandler): this {
    this.subHandlers.set(name, handler);
    return this;
  }

  build(factory: (self: CommandBuilder) => CommandBuilder): CommandBuilder {
    return factory(this);
  }

  run(handler: RunHandler): this {
    if (typeof this.help === "function") this.help = { hints: [] };
    if (!this.autocompleteDeclared) this.autocomplete = undefined;
    this.runHandler = handler;
    return this;
  }

  catch<E extends Error>(errorClass: ErrorConstructor<E>, handler: CatchHandler<E>): this {
    this.catchHandlers.push({ errorClass, handler: handler as CatchHandler<Error> });
    return this;
  }

  async execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
    const context = this.context(interaction, ctx);
    try {
      if (this.requireGuild && (!interaction.guildId || !interaction.guild)) {
        await ctx.respond.send({
          content: "This command can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (this.deferVisibility) await ctx.respond.defer({ visibility: this.deferVisibility });
      // Cooldown gate — check each declared spec; fire the first that's still active.
      for (const spec of this.cooldownSpecs) {
        const scopeId = this.cooldownScopeId(interaction, spec.scope);
        if (!scopeId) continue;
        const cdKey = `${this.data.name}:${spec.scope}`;
        if (ctx.cooldowns.isOnCooldown(scopeId, cdKey)) {
          const remaining = ctx.cooldowns.getRemainingMs(scopeId, cdKey);
          const expiresAt = Math.floor((Date.now() + remaining) / 1000);
          await ctx.respond.send({
            content: `You can use this again <t:${expiresAt}:R>.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      const subGroup = getSubcommandGroup(interaction, false);
      const subName = getSubcommand(interaction, false);
      const dispatchKey = subGroup ? `${subGroup}:${subName}` : (subName ?? "");
      const handler = (dispatchKey ? this.subHandlers.get(dispatchKey) : undefined) ?? this.runHandler;
      const response = await handler?.(context);
      if (response !== undefined) await ctx.respond.send(response);
      // Record cooldowns only after a successful (non-throwing) handler return.
      for (const spec of this.cooldownSpecs) {
        const scopeId = this.cooldownScopeId(interaction, spec.scope);
        if (scopeId) ctx.cooldowns.set(scopeId, `${this.data.name}:${spec.scope}`, spec.durationMs);
      }
    } catch (error) {
      if (error instanceof ResponseSentinel) {
        await ctx.respond.send(error.response);
        return;
      }
      const response = await this.handleError(error, context);
      if (response !== undefined) {
        await ctx.respond.send(response);
        return;
      }
      throw error;
    }
  }

  private addOption(option: OptionDefinition): this {
    this.options.push(option);
    applyOption(this.data, option);
    return this;
  }

  private context(interaction: ChatInputCommandInteraction, ctx: Ctx): CommandContextBase {
    const user = interaction.user ?? ({ id: "" } as ChatInputCommandInteraction["user"]);
    // Options are extracted lazily on first access: a handler that early-returns
    // (e.g. a guild guard) never pays for extraction, and Discord's required-option
    // guarantee is only consulted when the value is actually read.
    let optionsCache: Readonly<Record<string, unknown>> | undefined;
    const readOptions = (): Readonly<Record<string, unknown>> => {
      if (optionsCache === undefined) {
        optionsCache = extractOptions(interaction, this.optionsFor(interaction));
      }
      return optionsCache;
    };
    return {
      interaction,
      ctx,
      user,
      userId: user.id,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member,
      get options() {
        return readOptions();
      },
      subcommand: getSubcommand(interaction, false),
      subcommandGroup: getSubcommandGroup(interaction, false),
      expect: <T, E>(result: Result<T, E>): T => {
        if (result.isErr()) throw result.error;
        return result.unwrap();
      },
      unwrap: <T, E>(result: Result<T, E>, mapErr: (e: E) => CommandResponse): T => {
        if (result.isErr()) throw new ResponseSentinel(mapErr(result.error));
        return result.unwrap();
      },
      unwrapOr: <T>(result: Result<T, unknown>, fallback: T): T => {
        return result.isErr() ? fallback : result.unwrap();
      },
      ok: (markdown: string) => v2Message(container("ok", text(markdown))),
      fail: (markdown: string) => v2Message(container("danger", text(markdown))),
      info: (markdown: string) => v2Message(container("info", text(markdown))),
      warn: (markdown: string) => v2Message(container("mute", text(markdown))),
    };
  }

  private optionsFor(interaction: ChatInputCommandInteraction): readonly OptionDefinition[] {
    const group = getSubcommandGroup(interaction, false);
    const subcommand = getSubcommand(interaction, false);
    const jsonOptions = (
      (this.data.toJSON() as { options?: readonly SlashOptionJson[] }).options ?? []
    ).map(optionDefinitionFromJson);
    if (group && subcommand) {
      return (
        this.groups
          .find((entry) => entry.name === group)
          ?.subcommands.find((entry) => entry.name === subcommand)?.options ??
        jsonOptions
          .find((entry) => entry.name === group)
          ?.children?.find((entry) => entry.name === subcommand)?.children ??
        []
      );
    }
    if (subcommand) {
      return (
        this.subcommands.find((entry) => entry.name === subcommand)?.options ??
        jsonOptions.find((entry) => entry.name === subcommand)?.children ??
        []
      );
    }
    return this.options.length > 0 ? this.options : jsonOptions.filter((entry) => !entry.children);
  }

  private cooldownScopeId(
    interaction: ChatInputCommandInteraction,
    scope: CooldownScope,
  ): string | null {
    switch (scope) {
      case "user":
        return interaction.user.id;
      case "guild":
        return interaction.guildId;
      case "channel":
        return interaction.channelId;
      case "global":
        return "global";
    }
  }

  private async handleError(
    error: unknown,
    context: CommandContextBase,
  ): Promise<CommandResponse | undefined> {
    if (!(error instanceof Error)) throw error;
    for (const entry of this.catchHandlers) {
      if (error instanceof entry.errorClass)
        return (await entry.handler(error, context)) ?? undefined;
    }
    return undefined;
  }
}

function applySubcommand(
  builder: SlashCommandSubcommandBuilder,
  definition: SubcommandDefinition,
): SlashCommandSubcommandBuilder {
  builder.setName(definition.name).setDescription(definition.description);
  for (const option of definition.options) applyOption(builder, option);
  return builder;
}

function applyOption(
  builder: SlashCommandBuilder | SlashCommandSubcommandBuilder,
  definition: OptionDefinition,
): void {
  const applyBase = <
    T extends {
      setName(name: string): T;
      setDescription(description: string): T;
      setRequired(required: boolean): T;
    },
  >(
    option: T,
  ): T =>
    option
      .setName(definition.name)
      .setDescription(definition.description)
      .setRequired(definition.required === true);

  if (definition.kind === "string") {
    builder.addStringOption((option) => {
      const next = applyBase(option);
      if (definition.autocomplete) next.setAutocomplete(true);
      if (definition.min !== undefined) next.setMinLength(definition.min);
      if (definition.max !== undefined) next.setMaxLength(definition.max);
      if (definition.choices)
        next.addChoices(...(definition.choices as APIApplicationCommandOptionChoice<string>[]));
      return next;
    });
  } else if (definition.kind === "integer") {
    builder.addIntegerOption((option) => {
      const next = applyBase(option);
      if (definition.autocomplete) next.setAutocomplete(true);
      if (definition.min !== undefined) next.setMinValue(definition.min);
      if (definition.max !== undefined) next.setMaxValue(definition.max);
      if (definition.choices)
        next.addChoices(...(definition.choices as APIApplicationCommandOptionChoice<number>[]));
      return next;
    });
  } else if (definition.kind === "boolean") {
    builder.addBooleanOption((option) => applyBase(option));
  } else if (definition.kind === "user") {
    builder.addUserOption((option) => applyBase(option));
  } else if (definition.kind === "channel") {
    builder.addChannelOption((option) => {
      const next = applyBase(option);
      if (definition.channelTypes) next.addChannelTypes(...definition.channelTypes);
      return next;
    });
  } else if (definition.kind === "role") {
    builder.addRoleOption((option) => applyBase(option));
  } else if (definition.kind === "mentionable") {
    builder.addMentionableOption((option) => applyBase(option));
  } else {
    builder.addAttachmentOption((option) => applyBase(option));
  }
}

function extractOptions(
  interaction: ChatInputCommandInteraction,
  definitions: readonly OptionDefinition[],
): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  for (const definition of definitions) {
    const required = definition.required === true;
    if (definition.kind === "string")
      values[definition.name] = interaction.options.getString(definition.name, required);
    else if (definition.kind === "integer")
      values[definition.name] = interaction.options.getInteger(definition.name, required);
    else if (definition.kind === "boolean")
      values[definition.name] = interaction.options.getBoolean(definition.name, required);
    else if (definition.kind === "user")
      values[definition.name] = interaction.options.getUser(definition.name, required);
    else if (definition.kind === "channel")
      values[definition.name] = interaction.options.getChannel(definition.name, required);
    else if (definition.kind === "role")
      values[definition.name] = interaction.options.getRole(definition.name, required);
    else if (definition.kind === "mentionable")
      values[definition.name] = interaction.options.getMentionable(definition.name, required);
    else values[definition.name] = interaction.options.getAttachment(definition.name, required);
  }
  return values;
}

function optionDefinitionFromJson(option: SlashOptionJson): OptionDefinition {
  const children = option.options?.map(optionDefinitionFromJson);
  return {
    kind: optionKindFromType(option.type),
    name: option.name ?? "",
    description: option.description ?? "",
    required: option.required,
    autocomplete: option.autocomplete,
    min: option.min_value ?? option.min_length,
    max: option.max_value ?? option.max_length,
    choices: option.choices,
    children,
  };
}

function optionKindFromType(type: number | undefined): OptionKind {
  if (type === ApplicationCommandOptionType.Integer) return "integer";
  if (type === ApplicationCommandOptionType.Boolean) return "boolean";
  if (type === ApplicationCommandOptionType.User) return "user";
  if (type === ApplicationCommandOptionType.Channel) return "channel";
  if (type === ApplicationCommandOptionType.Role) return "role";
  if (type === ApplicationCommandOptionType.Mentionable) return "mentionable";
  if (type === ApplicationCommandOptionType.Attachment) return "attachment";
  return "string";
}

function getSubcommand(interaction: ChatInputCommandInteraction, required: boolean): string | null {
  try {
    return interaction.options.getSubcommand(required) ?? null;
  } catch {
    return null;
  }
}

function getSubcommandGroup(
  interaction: ChatInputCommandInteraction,
  required: boolean,
): string | null {
  try {
    return interaction.options.getSubcommandGroup(required) ?? null;
  } catch {
    return null;
  }
}

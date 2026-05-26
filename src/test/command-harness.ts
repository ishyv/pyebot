import type {
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  Interaction,
  InteractionReplyOptions,
  User,
} from "discord.js";
import { MessageFlags } from "discord.js";
import { OkResult } from "@/core/result";
import { cooldowns, locks, sessions } from "@/core/state";
import type { CommandModule, Component, ComponentRecord, Ctx, Entity } from "@/framework";

export type ResponsePath = "ctx" | "raw" | "either";

export interface CommandOptionValues {
  readonly strings?: Readonly<Record<string, string | null>>;
  readonly integers?: Readonly<Record<string, number | null>>;
  readonly booleans?: Readonly<Record<string, boolean | null>>;
  readonly users?: Readonly<Record<string, Partial<User> | null>>;
  readonly channels?: Readonly<Record<string, unknown | null>>;
  readonly roles?: Readonly<Record<string, unknown | null>>;
  readonly mentionables?: Readonly<Record<string, unknown | null>>;
  readonly attachments?: Readonly<Record<string, unknown | null>>;
}

export interface CommandScenario {
  readonly commandName: string;
  readonly subcommand?: string;
  readonly subcommandGroup?: string;
  readonly options?: CommandOptionValues;
  readonly guild?: false | { readonly id?: string };
  readonly user?: Partial<User>;
  readonly isAdmin?: boolean;
  readonly expectResponse?: ResponsePath;
}

export type RawInteractionCall = {
  readonly method: "reply" | "deferReply" | "editReply" | "followUp";
  readonly payload?: unknown;
};

export type RespondCall =
  | { readonly method: "defer"; readonly options?: unknown }
  | { readonly method: "send" | "fail"; readonly payload?: unknown };

export interface CommandHarnessCalls {
  readonly raw: RawInteractionCall[];
  readonly respond: RespondCall[];
  readonly ctx: Array<{ readonly method: string; readonly args: readonly unknown[] }>;
}

function required<T>(name: string, value: T | null | undefined, isRequired?: boolean): T | null {
  if (value !== undefined && value !== null) return value;
  if (isRequired) throw new Error(`missing required option ${name}`);
  return null;
}

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    username: "hyvnt",
    tag: "hyvnt#0001",
    displayAvatarURL: () => "https://example.test/avatar.png",
    ...overrides,
  } as User;
}

function fakeMember(isAdmin: boolean): GuildMember {
  return {
    permissions: {
      has: (permission: unknown) => isAdmin || permission !== "ManageGuild",
    },
    roles: { cache: new Map() },
  } as unknown as GuildMember;
}

function fakeGuild(id: string): Guild {
  return {
    id,
    members: {
      fetch: async () => fakeMember(true),
      me: fakeMember(true),
    },
    channels: { cache: new Map() },
    bans: { remove: async () => undefined },
  } as unknown as Guild;
}

/**
 * Creates the smallest Discord-like chat input interaction that command tests need.
 * It records raw response calls and narrows option access through explicit scenario data.
 */
export function makeChatInputInteraction(scenario: CommandScenario): {
  interaction: ChatInputCommandInteraction;
  calls: { raw: RawInteractionCall[] };
} {
  const raw: RawInteractionCall[] = [];
  const user = fakeUser(scenario.user);
  const guildId = scenario.guild === false ? null : (scenario.guild?.id ?? "guild-1");
  const interaction = {
    commandName: scenario.commandName,
    guildId,
    guild: guildId ? fakeGuild(guildId) : null,
    user,
    member: guildId ? fakeMember(scenario.isAdmin ?? true) : null,
    memberPermissions: {
      has: () => scenario.isAdmin ?? true,
    },
    channelId: "channel-1",
    channel: { id: "channel-1", isTextBased: () => true },
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    isAutocomplete: () => false,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChannelSelectMenu: () => false,
    isMentionableSelectMenu: () => false,
    isRoleSelectMenu: () => false,
    isUserSelectMenu: () => false,
    isModalSubmit: () => false,
    isRepliable: () => true,
    options: {
      getSubcommand: (isRequired = true) =>
        required("subcommand", scenario.subcommand, isRequired) as string,
      getSubcommandGroup: (isRequired = false) =>
        required("subcommandGroup", scenario.subcommandGroup, isRequired) as string | null,
      getString: (name: string, isRequired?: boolean) =>
        required(name, scenario.options?.strings?.[name], isRequired),
      getInteger: (name: string, isRequired?: boolean) =>
        required(name, scenario.options?.integers?.[name], isRequired),
      getBoolean: (name: string, isRequired?: boolean) =>
        required(name, scenario.options?.booleans?.[name], isRequired),
      getUser: (name: string, isRequired?: boolean) => {
        const value = scenario.options?.users?.[name];
        return required(
          name,
          value === undefined ? undefined : value && fakeUser(value),
          isRequired,
        );
      },
      getChannel: (name: string, isRequired?: boolean) =>
        required(name, scenario.options?.channels?.[name], isRequired),
      getRole: (name: string, isRequired?: boolean) =>
        required(name, scenario.options?.roles?.[name], isRequired),
      getMentionable: (name: string, isRequired?: boolean) =>
        required(name, scenario.options?.mentionables?.[name], isRequired),
      getAttachment: (name: string, isRequired?: boolean) =>
        required(name, scenario.options?.attachments?.[name], isRequired),
      getFocused: () => "",
    },
    async reply(payload: InteractionReplyOptions) {
      raw.push({ method: "reply", payload });
      interaction.replied = true;
    },
    async deferReply(payload?: InteractionReplyOptions) {
      raw.push({ method: "deferReply", payload });
      interaction.deferred = true;
    },
    async editReply(payload: InteractionReplyOptions) {
      raw.push({ method: "editReply", payload });
      interaction.deferred = false;
      interaction.replied = true;
    },
    async followUp(payload: InteractionReplyOptions) {
      raw.push({ method: "followUp", payload });
    },
  };
  return { interaction: interaction as unknown as ChatInputCommandInteraction, calls: { raw } };
}

function componentKey(id: Entity, component: Component<unknown>): string {
  return `${component.collection}:${id}`;
}

/**
 * Creates a component-backed fake `Ctx` with a response recorder.
 * The fake is deliberately plain: it supports command smoke tests without hiding domain behavior.
 */
export function makeCommandCtx(
  options: { readonly guildId?: string; readonly records?: ReadonlyMap<string, unknown> } = {},
): {
  ctx: Ctx & { readonly guildId: string; readonly userId: string };
  calls: CommandHarnessCalls;
} {
  const records = new Map(options.records);
  const calls: CommandHarnessCalls = { raw: [], respond: [], ctx: [] };
  const ctx = {
    guildId: options.guildId ?? "guild-1",
    userId: "user-1",
    commandName: "test",
    featureId: "test",
    guildConfig: {},
    interaction: null,
    client: {} as Client,
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    },
    cooldowns,
    locks,
    sessions,
    respond: {
      async defer(options?: unknown) {
        calls.respond.push({ method: "defer", options });
        return OkResult(undefined);
      },
      async send(payload: InteractionReplyOptions) {
        calls.respond.push({ method: "send", payload });
        return OkResult(undefined);
      },
      async fail(payload: InteractionReplyOptions) {
        calls.respond.push({
          method: "fail",
          payload: { ...payload, flags: payload.flags ?? MessageFlags.Ephemeral },
        });
        return OkResult(undefined);
      },
    },
    async get<T>(id: Entity, component: Component<T>): Promise<T | null> {
      calls.ctx.push({ method: "get", args: [id, component.collection] });
      return (
        (records.get(componentKey(id, component as Component<unknown>)) as T | undefined) ?? null
      );
    },
    async ensure<T>(id: Entity, component: Component<T>): Promise<T> {
      calls.ctx.push({ method: "ensure", args: [id, component.collection] });
      const key = componentKey(id, component as Component<unknown>);
      if (!records.has(key)) records.set(key, {});
      return records.get(key) as T;
    },
    async set<T>(id: Entity, component: Component<T>, value: T): Promise<void> {
      calls.ctx.push({ method: "set", args: [id, component.collection, value] });
      records.set(componentKey(id, component as Component<unknown>), value);
    },
    async patch<T>(
      id: Entity,
      component: Component<T>,
      patch: Partial<T> | ((current: T) => Partial<T>),
    ): Promise<void> {
      calls.ctx.push({ method: "patch", args: [id, component.collection] });
      const key = componentKey(id, component as Component<unknown>);
      const current = (records.get(key) ?? {}) as T;
      const next = typeof patch === "function" ? patch(current) : patch;
      records.set(key, { ...(current as object), ...(next as object) });
    },
    async delete<T>(id: Entity, component: Component<T>): Promise<void> {
      calls.ctx.push({ method: "delete", args: [id, component.collection] });
      records.delete(componentKey(id, component as Component<unknown>));
    },
    async query<T>(component: Component<T>): Promise<ReadonlyArray<ComponentRecord<T>>> {
      calls.ctx.push({ method: "query", args: [component.collection] });
      return [];
    },
    async emit(event: unknown): Promise<void> {
      calls.ctx.push({ method: "emit", args: [event] });
    },
  };
  return {
    ctx: ctx as unknown as Ctx & { readonly guildId: string; readonly userId: string },
    calls,
  };
}

/**
 * Runs a real command callback with fake Discord input and asserts the response contract.
 */
export async function runCommandScenario(
  command: CommandModule,
  scenario: CommandScenario,
): Promise<{ calls: CommandHarnessCalls; interaction: Interaction }> {
  const { interaction, calls: interactionCalls } = makeChatInputInteraction(scenario);
  const { ctx, calls } = makeCommandCtx({ guildId: interaction.guildId ?? undefined });

  await command.execute(interaction, ctx);

  calls.raw.push(...interactionCalls.raw);
  const expected = scenario.expectResponse ?? "either";
  const hasCtxResponse = calls.respond.length > 0;
  const hasRawResponse = calls.raw.length > 0;
  if (expected === "ctx" && (!hasCtxResponse || hasRawResponse)) {
    throw new Error(`${scenario.commandName} expected ctx.respond only`);
  }
  if (expected === "raw" && !hasRawResponse) {
    throw new Error(`${scenario.commandName} expected raw interaction response`);
  }
  if (expected === "either" && !hasCtxResponse && !hasRawResponse) {
    throw new Error(`${scenario.commandName} did not record a response`);
  }
  return { calls, interaction };
}

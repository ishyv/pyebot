import { type Client, SlashCommandBuilder } from "discord.js";
import type {
  ComponentInteraction,
  EventRegistration,
  FeatureCommand,
  RuntimeFeature,
  MiddlewareFn,
} from "@/core/feature";
import type { FeatureConfigDefinition } from "@/core/featureConfig";

export type DiscordIntentName = string;
export type FeatureConstructor<T extends object = object> = new () => T;

export interface FeatureOptions {
  readonly id: string;
  readonly gate?: string;
  readonly intents?: readonly DiscordIntentName[];
  readonly config?: FeatureConfigDefinition;
}

export interface SlashCommandOptions {
  readonly name: string;
  readonly description: string;
  readonly data?:
    | FeatureCommand["data"]
    | ((builder: SlashCommandBuilder) => FeatureCommand["data"]);
  readonly middleware?: readonly MiddlewareFn[];
}

export interface ComponentOptions<TParsed = unknown> {
  readonly prefix: string;
  readonly matches?: (customId: string) => boolean;
  readonly parse?: (customId: string) => TParsed;
}

export interface EventOptions {
  readonly name: string;
  readonly intents?: readonly DiscordIntentName[];
  readonly once?: boolean;
  readonly register?: (client: Client) => void;
}

export interface JobOptions {
  readonly name: string;
  readonly everyMs: number;
  readonly runOnReady?: boolean;
}

interface SlashCommandMetadata extends SlashCommandOptions {
  readonly methodName: string;
}

interface ComponentMetadata extends ComponentOptions {
  readonly methodName: string;
  readonly kind: "button" | "select" | "modal";
}

interface EventMetadata extends EventOptions {
  readonly methodName: string;
}

interface JobMetadata extends JobOptions {
  readonly methodName: string;
}

interface FeatureMetadata {
  feature?: FeatureOptions;
  readonly classMiddleware: MiddlewareFn[];
  readonly commands: SlashCommandMetadata[];
  readonly components: ComponentMetadata[];
  readonly events: EventMetadata[];
  readonly jobs: JobMetadata[];
  readonly methodMiddleware: Map<string, MiddlewareFn[]>;
}

const metadataByClass = new WeakMap<object, FeatureMetadata>();

export function Feature(options: FeatureOptions): ClassDecorator {
  return (target) => {
    const metadata = metadataFor(target);
    metadata.feature = options;
  };
}

export function SlashCommand(options: SlashCommandOptions): MethodDecorator {
  return (target, propertyKey) => {
    metadataFor(target.constructor).commands.push({
      ...options,
      methodName: String(propertyKey),
    });
  };
}

export function Button<TParsed = unknown>(options: ComponentOptions<TParsed>): MethodDecorator {
  return componentDecorator("button", options);
}

export function Select<TParsed = unknown>(options: ComponentOptions<TParsed>): MethodDecorator {
  return componentDecorator("select", options);
}

export function Modal<TParsed = unknown>(options: ComponentOptions<TParsed>): MethodDecorator {
  return componentDecorator("modal", options);
}

export function Event(event: string | EventOptions): MethodDecorator {
  const options = typeof event === "string" ? { name: event } : event;
  return (target, propertyKey) => {
    metadataFor(target.constructor).events.push({
      ...options,
      methodName: String(propertyKey),
    });
  };
}

export function Job(options: JobOptions): MethodDecorator {
  return (target, propertyKey) => {
    metadataFor(target.constructor).jobs.push({
      ...options,
      methodName: String(propertyKey),
    });
  };
}

export function Use(...middleware: readonly MiddlewareFn[]): ClassDecorator & MethodDecorator {
  const decorator = (target: object, propertyKey?: string | symbol) => {
    if (propertyKey === undefined) {
      metadataFor(target).classMiddleware.push(...middleware);
      return;
    }

    const metadata = metadataFor(target.constructor);
    const key = String(propertyKey);
    const existing = metadata.methodMiddleware.get(key) ?? [];
    existing.push(...middleware);
    metadata.methodMiddleware.set(key, existing);
  };
  return decorator as ClassDecorator & MethodDecorator;
}

export function compileFeatureClass<T extends object>(
  FeatureClass: FeatureConstructor<T>,
): RuntimeFeature {
  const metadata = metadataByClass.get(FeatureClass);
  if (!metadata?.feature) {
    throw new Error(`Class "${FeatureClass.name}" is missing @Feature metadata.`);
  }

  const instance = new FeatureClass();
  const declaredIntents = new Set(metadata.feature.intents ?? []);
  validateDeclaredIntents(metadata.feature, metadata.events, declaredIntents);

  const timers = new Set<ReturnType<typeof setInterval>>();
  const commands = metadata.commands.map(
    (command): FeatureCommand => ({
      data: commandData(command),
      execute: async (interaction, ctx) => {
        await invoke(instance, command.methodName, interaction, ctx);
      },
      middleware: [
        ...metadata.classMiddleware,
        ...(command.middleware ?? []),
        ...(metadata.methodMiddleware.get(command.methodName) ?? []),
      ],
    }),
  );

  const components = metadata.components.map((component) => ({
    prefix: component.prefix,
    matches: component.matches ?? ((customId: string) => customId.startsWith(component.prefix)),
    handle: async (interaction: ComponentInteraction) => {
      const parsed = component.parse?.(interaction.customId);
      await invoke(instance, component.methodName, interaction, parsed);
    },
  }));

  const events = metadata.events.map(
    (event): EventRegistration => ({
      event: event.name,
      register: (client: Client) => {
        if (event.register) {
          event.register(client);
          return;
        }
        const register = event.once ? client.once.bind(client) : client.on.bind(client);
        register(event.name as never, async (...args: never[]) => {
          await invoke(instance, event.methodName, ...args);
        });
      },
    }),
  );

  return {
    id: metadata.feature.id,
    featureGate: metadata.feature.gate,
    config: metadata.feature.config,
    capabilities: metadata.feature.intents?.length
      ? { discordIntents: metadata.feature.intents }
      : undefined,
    commands,
    components,
    events,
    onLoad: lifecycle(instance, "onLoad"),
    onReady: async (client) => {
      const onReady = lifecycle(instance, "onReady");
      if (onReady) await onReady(client);
      for (const job of metadata.jobs) {
        if (job.runOnReady) {
          Promise.resolve(invoke(instance, job.methodName, client)).catch((err) => {
            console.error(`[framework:job:${job.name}]`, err);
          });
        }
        const timer = setInterval(() => {
          Promise.resolve(invoke(instance, job.methodName, client)).catch((err) => {
            console.error(`[framework:job:${job.name}]`, err);
          });
        }, job.everyMs);
        timers.add(timer);
      }
    },
    onShutdown: async () => {
      for (const timer of timers) clearInterval(timer);
      timers.clear();
      const onShutdown = lifecycle(instance, "onShutdown");
      if (onShutdown) await onShutdown();
    },
  };
}

export function compileFeatureClasses(sources: readonly FeatureConstructor[]): RuntimeFeature[] {
  const modules = sources.map((source, index) => {
    if (typeof source !== "function") {
      throw new Error(`Feature source at index ${index} must be a decorated class.`);
    }
    return compileFeatureClass(source);
  });
  validateUniqueFeatures(modules);
  validateUniqueCommands(modules);
  validateUniqueComponentPrefixes(modules);
  return modules;
}

function componentDecorator<TParsed>(
  kind: ComponentMetadata["kind"],
  options: ComponentOptions<TParsed>,
): MethodDecorator {
  return (target, propertyKey) => {
    metadataFor(target.constructor).components.push({
      ...options,
      kind,
      methodName: String(propertyKey),
    });
  };
}

function metadataFor(target: object): FeatureMetadata {
  let metadata = metadataByClass.get(target);
  if (!metadata) {
    metadata = {
      classMiddleware: [],
      commands: [],
      components: [],
      events: [],
      jobs: [],
      methodMiddleware: new Map(),
    };
    metadataByClass.set(target, metadata);
  }
  return metadata;
}

function commandData(command: SlashCommandMetadata): FeatureCommand["data"] {
  if (typeof command.data === "function") {
    return command.data(
      new SlashCommandBuilder().setName(command.name).setDescription(command.description),
    );
  }
  if (command.data) return command.data;
  return new SlashCommandBuilder().setName(command.name).setDescription(command.description);
}

async function invoke(instance: object, methodName: string, ...args: unknown[]): Promise<unknown> {
  const method = (instance as Record<string, unknown>)[methodName];
  if (typeof method !== "function") {
    throw new Error(`Decorated method "${methodName}" is not callable.`);
  }
  return await method.apply(instance, args);
}

function lifecycle(instance: object, methodName: "onLoad" | "onReady" | "onShutdown") {
  const method = (instance as Record<string, unknown>)[methodName];
  if (typeof method !== "function") return undefined;
  return async (...args: unknown[]) => {
    await method.apply(instance, args);
  };
}

function validateDeclaredIntents(
  feature: FeatureOptions,
  events: readonly EventMetadata[],
  declaredIntents: ReadonlySet<string>,
): void {
  for (const event of events) {
    for (const intent of event.intents ?? []) {
      if (!declaredIntents.has(intent)) {
        throw new Error(
          `Feature "${feature.id}" handles "${event.name}" but does not declare required intent "${intent}".`,
        );
      }
    }
  }
}

function validateUniqueFeatures(modules: readonly RuntimeFeature[]): void {
  const seen = new Set<string>();
  for (const mod of modules) {
    if (seen.has(mod.id)) {
      throw new Error(`Feature "${mod.id}" is already registered.`);
    }
    seen.add(mod.id);
  }
}

function validateUniqueCommands(modules: readonly RuntimeFeature[]): void {
  const seen = new Map<string, string>();
  for (const mod of modules) {
    for (const command of mod.commands) {
      const owner = seen.get(command.data.name);
      if (owner) {
        throw new Error(
          `Command "${command.data.name}" is already registered by feature "${owner}".`,
        );
      }
      seen.set(command.data.name, mod.id);
    }
  }
}

function validateUniqueComponentPrefixes(modules: readonly RuntimeFeature[]): void {
  const seen = new Map<string, string>();
  for (const mod of modules) {
    for (const component of mod.components ?? []) {
      const owner = seen.get(component.prefix);
      if (owner) {
        throw new Error(
          `Component prefix "${component.prefix}" is already registered by feature "${owner}".`,
        );
      }
      seen.set(component.prefix, mod.id);
    }
  }
}


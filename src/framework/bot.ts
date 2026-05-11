import { type Client, Events, REST, Routes } from "discord.js";
import { loadContentRegistry } from "@/content/registry";
import { createClient } from "@/core/client";
import { disconnectDb, getDb } from "@/core/db";
import { createDispatcher } from "@/core/dispatcher";
import { setFeatureCatalog } from "@/core/featureCatalog";
import { createLogger } from "@/core/logger";
import { FeatureRegistry } from "@/core/registry";
import { compileFeatureClasses, type FeatureConstructor } from "@/framework/decorators";
import type { StorageAdapter } from "@/framework/storage";

const log = createLogger("framework:bot");

const DEFAULT_LOGIN_RETRY_ATTEMPTS = 5;
const DEFAULT_LOGIN_RETRY_DELAY_MS = 2_000;

export interface CreateBotOptions {
  readonly name: string;
  readonly token?: string;
  readonly clientId?: string;
  readonly guildId?: string;
  readonly features: readonly FeatureConstructor[];
  readonly storage?: StorageAdapter;
  readonly loadContent?: boolean;
  readonly registerCommands?: boolean;
  readonly connectMongo?: boolean;
  readonly loginRetryAttempts?: number;
  readonly loginRetryDelayMs?: number;
}

export interface BotApplication {
  readonly name: string;
  readonly registry: FeatureRegistry;
  readonly client: Client;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createBot(options: CreateBotOptions): BotApplication {
  const modules = compileFeatureClasses(options.features);
  const registry = new FeatureRegistry();
  for (const mod of modules) registry.register(mod);
  setFeatureCatalog(registry.allFeatures());

  const client = createClient();
  const dispatch = createDispatcher(registry);
  client.on("interactionCreate", dispatch);

  for (const feature of registry.allFeatures()) {
    for (const event of feature.events ?? []) event.register(client);
  }

  let started = false;

  return {
    name: options.name,
    registry,
    client,
    async start() {
      if (started) return;
      started = true;

      await options.storage?.connect?.();
      if (options.connectMongo ?? !options.storage) {
        await getDb();
      }

      if (shouldLoadContent(options)) {
        const reg = await loadContentRegistry();
        log.info(`Content registry loaded from ${reg.loadedFrom}`);
      }

      for (const feature of registry.allFeatures()) {
        await Promise.resolve(feature.onLoad?.()).catch((err) => {
          throw new Error(`onLoad failed for feature "${feature.id}": ${String(err)}`);
        });
      }

      const token = options.token ?? process.env.DISCORD_TOKEN;
      if (!token) throw new Error("DISCORD_TOKEN environment variable is not set.");

      client.once(Events.ClientReady, async (readyClient) => {
        log.info(`${options.name} logged in as ${readyClient.user.tag}`);

        for (const feature of registry.allFeatures()) {
          await Promise.resolve(feature.onReady?.(readyClient)).catch((err) => {
            log.error(`onReady error in feature "${feature.id}"`, err);
          });
        }

        if (options.registerCommands ?? true) {
          await registerSlashCommands({
            token,
            clientId: options.clientId ?? process.env.CLIENT_ID ?? readyClient.user.id,
            guildId: options.guildId ?? process.env.GUILD_ID,
            commands: registry.allCommandData(),
          });
        }
      });

      try {
        await loginWithRetry(client, token, {
          attempts: options.loginRetryAttempts ?? DEFAULT_LOGIN_RETRY_ATTEMPTS,
          baseDelayMs: options.loginRetryDelayMs ?? DEFAULT_LOGIN_RETRY_DELAY_MS,
        });
      } catch (error) {
        started = false;
        throw error;
      }
    },
    async stop() {
      for (const feature of [...registry.allFeatures()].reverse()) {
        await Promise.resolve(feature.onShutdown?.()).catch((err) => {
          log.error(`Shutdown error in feature "${feature.id}"`, err);
        });
      }
      await client.destroy();
      await options.storage?.disconnect?.();
      if (options.connectMongo ?? !options.storage) {
        await disconnectDb();
      }
      started = false;
    },
  };
}

interface LoginRetryOptions {
  readonly attempts: number;
  readonly baseDelayMs: number;
}

async function loginWithRetry(
  client: Pick<Client, "login">,
  token: string,
  options: LoginRetryOptions,
): Promise<void> {
  const attempts = Math.max(1, options.attempts);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.login(token);
      return;
    } catch (error) {
      if (attempt >= attempts || !isRetriableDiscordStartupError(error)) {
        throw error;
      }

      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      log.warn(
        `Discord login failed with a transient gateway error; retrying in ${delayMs}ms (${attempt}/${attempts})`,
        error,
      );
      await sleep(delayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetriableDiscordStartupError(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  return status === 429 || (status >= 500 && status <= 599);
}

function shouldLoadContent(options: CreateBotOptions): boolean {
  if (options.loadContent !== undefined) return options.loadContent;
  return options.connectMongo ?? !options.storage;
}

async function registerSlashCommands(input: {
  readonly token: string;
  readonly clientId: string;
  readonly guildId?: string;
  readonly commands: readonly unknown[];
}): Promise<void> {
  const rest = new REST().setToken(input.token);
  if (input.guildId) {
    await rest.put(Routes.applicationGuildCommands(input.clientId, input.guildId), {
      body: input.commands,
    });
    log.info(`Registered ${input.commands.length} guild commands (guild: ${input.guildId})`);
    return;
  }

  await rest.put(Routes.applicationCommands(input.clientId), { body: input.commands });
  log.info(`Registered ${input.commands.length} global commands`);
}

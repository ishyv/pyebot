/**
 * Bootstrap sequence.
 *
 * Order (explicit, top-to-bottom readable):
 * 1. Connect MongoDB
 * 2. Load content packs (optional)
 * 3. Load features from manifest, call onLoad() on each
 * 4. Create Discord client (intents derived from base + feature declarations)
 * 5. Register dispatcher as the single interactionCreate handler
 * 6. Register all feature event handlers (guildMemberAdd, messageCreate, etc.)
 * 7. Register shutdown hooks
 * 8. Login
 * 9. On ready: upload slash commands via REST, call onReady() on each feature
 */

import { REST, Routes } from "discord.js";
import { getDb, disconnectDb } from "@/core/db";
import { createClient } from "@/core/client";
import { createLogger } from "@/core/logger";
import { FeatureRegistry } from "@/core/registry";
import { createDispatcher } from "@/core/dispatcher";
import { loadContentRegistry } from "@/content/registry";
import { featureFactories } from "@/features/manifest";

const log = createLogger("bootstrap");

export async function bootstrap(): Promise<void> {
  log.info("Starting tx-v2...");

  // 1. MongoDB
  await getDb();
  log.info("MongoDB connected.");

  // 2. Content packs (optional)
  const contentDir = process.env.CONTENT_PACKS_DIR;
  if (contentDir) {
    const reg = await loadContentRegistry(contentDir);
    if (reg) {
      log.info(`Content registry loaded from ${reg.loadedFrom}`);
    }
  } else {
    log.info("CONTENT_PACKS_DIR not set — running without content packs.");
  }

  // 3. Load features
  const registry = new FeatureRegistry();
  for (const factory of featureFactories) {
    let mod;
    try {
      mod = await factory();
    } catch (err) {
      log.error("Failed to load feature — skipping", err);
      continue;
    }
    registry.register(mod);
    if (mod.onLoad) {
      await mod.onLoad();
    }
  }

  // 4. Create client
  const client = createClient();

  // 5. Interaction dispatcher
  const dispatch = createDispatcher(registry);
  client.on("interactionCreate", dispatch);

  // 6. Feature event handlers
  for (const feature of registry.allFeatures()) {
    for (const reg of feature.events ?? []) {
      reg.register(client);
    }
  }

  // 7. Shutdown
  const shutdown = async () => {
    log.info("Shutting down...");
    for (const feature of registry.allFeatures()) {
      if (feature.onShutdown) {
        await Promise.resolve(feature.onShutdown()).catch((err) => log.error(`Shutdown error in feature "${feature.id}"`, err));
      }
    }
    await client.destroy();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 8. Login
  const token = process.env.TOKEN;
  if (!token) throw new Error("TOKEN environment variable is not set.");
  await client.login(token);

  // 9. Ready
  client.once("ready", async (c) => {
    log.info(`Logged in as ${c.user.tag}`);

    for (const feature of registry.allFeatures()) {
      if (feature.onReady) {
        await Promise.resolve(feature.onReady(c)).catch((err) =>
          log.error(`onReady error in feature "${feature.id}"`, err),
        );
      }
    }

    const clientId = process.env.CLIENT_ID ?? c.user.id;
    const guildId = process.env.GUILD_ID;

    try {
      const rest = new REST().setToken(token);
      const body = registry.allCommandData();

      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
        log.info(`Registered ${body.length} guild commands (guild: ${guildId})`);
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body });
        log.info(`Registered ${body.length} global commands`);
      }
    } catch (err) {
      log.error("Failed to register slash commands", err);
    }
  });
}

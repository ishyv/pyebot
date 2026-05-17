/**
 * Minimal bootstrap. The contents of this file are intentionally tiny:
 * the framework does the work, this file is just the glue between
 * "Discord events" and "framework dispatch".
 *
 * Everything interesting lives in `src/framework/*`. Adding a feature
 * never touches this file.
 *
 * Order:
 *   1. Load env.
 *   2. Connect MongoDB (via World.create).
 *   3. Bootstrap the framework — scans features, builds command map,
 *      builds router, generates /features, wires the event bus.
 *   4. Register `interactionCreate` → framework dispatch.
 *   5. Forward Discord events that features want via the bus.
 *   6. Log in. On clientReady, push slash command definitions via REST.
 */

import "dotenv/config";
import { Events, REST, Routes } from "discord.js";
import { createClient } from "@/core/client";
import { disconnectDb } from "@/core/db";
import { registerMessageDeleteListener } from "@/core/importantMessages";
import { createLogger } from "@/core/logger";
import { MemberJoined } from "@/events/member-joined";
import { reregisterQueueMessage } from "@/features/moderation/appeals";
import { bootstrapFramework } from "@/framework/bootstrap";

const log = createLogger("bootstrap");

async function bootstrap(): Promise<void> {
  log.info("Starting tx-v2...");

  const client = createClient();
  registerMessageDeleteListener(client);
  const { dispatch, commands, world } = await bootstrapFramework(client);

  client.on("interactionCreate", (interaction) => {
    void dispatch(interaction);
  });

  // Forward a small set of Discord events into the framework event bus so
  // features can react via @On(MemberJoined) etc. without registering a
  // Discord listener themselves.
  client.on("guildMemberAdd", async (member) => {
    try {
      await world.bus.emit(
        new MemberJoined(member.id, member.guild.id),
        world.forInteraction(null, "framework"),
      );
    } catch (err) {
      log.error("Failed to forward guildMemberAdd", err);
    }
  });

  const shutdown = async () => {
    log.info("Shutting down...");
    await client.destroy();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("TOKEN environment variable is not set.");
  await client.login(token);

  client.once(Events.ClientReady, async (c) => {
    log.info(`Logged in as ${c.user.tag} (${commands.length} commands loaded)`);

    // Re-register appeals queue messages as important for all guilds.
    for (const guild of c.guilds.cache.values()) {
      reregisterQueueMessage(guild).catch(() => null);
    }

    if (process.env.WEBAPP === "true") {
      const { startWebApp } = await import("@/webapp/server");
      await startWebApp(c);
    }

    const clientId = process.env.CLIENT_ID ?? c.user.id;
    const guildId = process.env.GUILD_ID;

    try {
      const rest = new REST().setToken(token);
      const body = commands.map((cmd) => cmd.data.toJSON());
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

bootstrap().catch((err) => {
  log.error("Fatal startup error", err);
  process.exit(1);
});

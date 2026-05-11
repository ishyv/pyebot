/**
 * Bundled tx-v2 bot bootstrap.
 *
 * The public framework runtime lives in `src/framework`. This file loads the
 * decorated feature classes from the manifest, hands them to `createBot`, and
 * installs process shutdown hooks for the bundled full bot.
 */

import { createLogger } from "@/core/logger";
import { featureFactories } from "@/features/manifest";
import { createBot, type FeatureConstructor } from "@/framework";

const log = createLogger("bootstrap");

export async function bootstrap(): Promise<void> {
  log.info("Starting tx-v2...");

  const features: FeatureConstructor[] = [];
  for (const factory of featureFactories) {
    try {
      features.push(await factory());
    } catch (err) {
      log.error("Failed to load feature — skipping", err);
    }
  }

  const app = createBot({
    name: "tx-v2",
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    features,
    connectMongo: true,
  });

  const shutdown = async () => {
    log.info("Shutting down...");
    await app.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.start();
}

/**
 * Legacy application bootstrap.
 *
 * The public framework runtime now lives in `src/framework`. This file keeps
 * the existing bundled tx-v2 bot entrypoint small: load legacy feature modules
 * from the manifest, hand them to `createBot`, and install process shutdown
 * hooks. New template bots should call `createBot` directly.
 */

import type { FeatureModule } from "@/core/feature";
import { createLogger } from "@/core/logger";
import { featureFactories } from "@/features/manifest";
import { createBot } from "@/framework/bot";

const log = createLogger("bootstrap");

export async function bootstrap(): Promise<void> {
  log.info("Starting tx-v2...");

  const features: FeatureModule[] = [];
  for (const factory of featureFactories) {
    try {
      features.push(await factory());
    } catch (err) {
      log.error("Failed to load feature — skipping", err);
    }
  }

  const app = createBot({
    name: "tx-v2",
    token: process.env.TOKEN ?? process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    contentDir: process.env.CONTENT_PACKS_DIR,
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

import { createClient } from "@/core/client";
import { getDb, disconnectDb } from "@/core/db";
import { createLogger } from "@/core/logger";

const log = createLogger("bootstrap");

async function bootstrap(): Promise<void> {
  log.info("Starting tx-v2...");

  await getDb();
  log.info("MongoDB connected.");

  const client = createClient();

  // Feature event handlers registered here (added by subsequent feature plans)

  client.once("ready", (c) => {
    log.info(`Logged in as ${c.user.tag}`);
  });

  process.on("SIGINT", async () => {
    log.info("Shutting down...");
    await client.destroy();
    await disconnectDb();
    process.exit(0);
  });

  const token = process.env.TOKEN;
  if (!token) throw new Error("TOKEN environment variable is not set.");
  await client.login(token);
}

bootstrap().catch((err) => {
  console.error("[bootstrap] Fatal:", err);
  process.exit(1);
});

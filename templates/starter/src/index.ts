import { createBot, loadEnvFile, MemoryStorageAdapter } from "@/framework";
import { HelloFeature } from "./features/hello";

for (const [key, value] of Object.entries(loadEnvFile())) {
  process.env[key] ??= value;
}

const bot = createBot({
  name: "tx-v2-starter",
  features: [HelloFeature],
  storage: new MemoryStorageAdapter(),
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
});

await bot.start();

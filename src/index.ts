import { bootstrap } from "@/core/bootstrap";
import { createLogger } from "@/core/logger";
import { loadEnvFile } from "@/framework/doctor";

for (const [key, value] of Object.entries(loadEnvFile())) {
  process.env[key] ??= value;
}

const log = createLogger("main");

bootstrap().catch((err) => {
  log.error("Fatal startup error", err);
  process.exit(1);
});

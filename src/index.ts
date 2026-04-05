import "dotenv/config";
import { bootstrap } from "@/core/bootstrap";
import { createLogger } from "@/core/logger";

const log = createLogger("main");

bootstrap().catch((err) => {
  log.error("Fatal startup error", err);
  process.exit(1);
});

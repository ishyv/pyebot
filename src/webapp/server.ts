/**
 * Boots the SvelteKit Node server inside the bot process when `WEBAPP=true`.
 *
 * The webapp is built ahead of time with the SvelteKit Node adapter, which
 * produces `webapp/build/handler.js`. This module imports that handler and
 * mounts it on a plain Node HTTP server. The webapp's server-side code can
 * then `import { getBridge } from "@/webapp/bridge"` directly — same process,
 * no HTTP between them.
 */

import { createServer } from "node:http";
import type { Client } from "discord.js";
import { createLogger } from "@/core/logger";
import { reloadRpgContent } from "@/features/rpg/content/runtime";
import { createBridgeFromClient } from "./bot-bridge";
import { registerBridge } from "./bridge";

const log = createLogger("webapp");

export async function startWebApp(client: Client): Promise<void> {
  const rpgReload = await reloadRpgContent();
  if (rpgReload.isErr()) {
    log.warn(`Dashboard RPG content reload skipped: ${rpgReload.error.message}`);
  }
  registerBridge(createBridgeFromClient(client));

  const handlerUrl = new URL("../../webapp/build/handler.js", import.meta.url);
  let handler: (req: unknown, res: unknown, next?: () => void) => void;
  try {
    const mod = (await import(handlerUrl.href)) as {
      handler: (req: unknown, res: unknown, next?: () => void) => void;
    };
    handler = mod.handler;
  } catch (err) {
    log.error(
      "Webapp build not found at webapp/build/handler.js. Run `cd webapp && bun run build` first.",
      err,
    );
    return;
  }

  const port = Number(process.env.WEBAPP_PORT ?? 4000);
  const server = createServer((req, res) => handler(req, res));
  server.listen(port, () => {
    log.info(`Webapp listening on http://localhost:${port}`);
  });
}

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
import { getEnv } from "@/core/env";
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

  const port = getEnv().WEBAPP_PORT;

  // The SvelteKit Node adapter defaults the request protocol to `https` when
  // neither ORIGIN nor PROTOCOL_HEADER is set (see get_origin in the built
  // handler). On a plain-http localhost that makes the server's computed origin
  // (https://localhost:PORT) disagree with the browser's Origin header
  // (http://localhost:PORT), so SvelteKit's CSRF guard rejects every POST form
  // action with 403. Set ORIGIN before importing the handler (it reads the env
  // at module load) so form submissions work out of the box. An explicitly set
  // ORIGIN — e.g. a production https domain — is always respected.
  if (!process.env.ORIGIN) {
    const redirectUri = getEnv().DISCORD_REDIRECT_URI;
    try {
      process.env.ORIGIN = redirectUri ? new URL(redirectUri).origin : `http://localhost:${port}`;
    } catch {
      process.env.ORIGIN = `http://localhost:${port}`;
    }
  }

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

  const server = createServer((req, res) => handler(req, res));
  server.listen(port, () => {
    log.info(`Webapp listening on ${process.env.ORIGIN} (port ${port})`);
  });
}

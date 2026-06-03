/**
 * Event-driven scripts: when a supported Discord event fires, run every stored
 * script in that guild bound to it. The triggering member is passed as the
 * script's `ctx.invoker` so a script can act on whoever caused the event.
 */
import type { Client } from "discord.js";
import { ScriptDefinition, type ScriptEvent } from "@/components/script-definition";
import { createLogger } from "@/core/logger";
import type { Ctx } from "@/framework/types";
import { dispatchScript } from "./dispatch";

const log = createLogger("scripts:event");

export async function runEventScripts(
  client: Client,
  ctx: Ctx,
  event: ScriptEvent,
  guildId: string,
  invoker: { id: string; tag: string } | null,
): Promise<void> {
  const scripts = await ctx.query(ScriptDefinition, {
    filter: { "trigger.kind": "event", "trigger.event": event, guildId, enabled: true },
  });

  for (const def of scripts) {
    try {
      await dispatchScript(client, def, { invoker });
    } catch (err) {
      log.warn(`Event script ${def._id} failed`, err);
    }
  }
}

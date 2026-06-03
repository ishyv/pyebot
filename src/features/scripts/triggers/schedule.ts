/**
 * Scheduled-script sweep. Mirrors the embeds scheduled runtime: a periodic pass
 * finds scripts whose next run is due, runs them, and advances the clock.
 */
import type { Client } from "discord.js";
import { ScriptDefinition } from "@/components/script-definition";
import { createLogger } from "@/core/logger";
import type { Ctx } from "@/framework/types";
import { saveExistingScript } from "../persistence";
import { dispatchScript } from "./dispatch";

const log = createLogger("scripts:schedule");

const HOUR_MS = 3_600_000;

export async function runScheduleSweep(client: Client, ctx: Ctx): Promise<void> {
  const now = new Date();
  const due = await ctx.query(ScriptDefinition, {
    filter: { "trigger.kind": "schedule", enabled: true, scheduleNextRunAt: { $lte: now } },
  });

  for (const def of due) {
    try {
      await dispatchScript(client, def);
    } catch (err) {
      log.warn(`Scheduled script ${def._id} failed`, err);
    }
    const intervalHours = def.trigger.kind === "schedule" ? def.trigger.intervalHours : 24;
    await saveExistingScript(ctx, def._id, def, {
      scheduleNextRunAt: new Date(Date.now() + intervalHours * HOUR_MS),
    });
  }
}

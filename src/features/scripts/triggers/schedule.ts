/**
 * Scheduled-script sweep. Mirrors the embeds scheduled runtime: a periodic pass
 * finds scripts whose next run is due, runs them, and advances the clock.
 */
import type { Client } from "discord.js";
import { scriptId } from "@/components/script-definition";
import { createLogger } from "@/core/logger";
import type { Ctx } from "@/framework/types";
import { findDueScheduledScripts, saveExistingScript } from "../persistence";
import { dispatchScript } from "./dispatch";

const log = createLogger("scripts:schedule");

const HOUR_MS = 3_600_000;

export async function runScheduleSweep(client: Client, ctx: Ctx): Promise<void> {
  const now = new Date();
  const due = await findDueScheduledScripts(ctx, now);

  for (const def of due) {
    try {
      await dispatchScript(client, def);
    } catch (err) {
      log.warn(`Scheduled script ${scriptId(def.guildId, def.name)} failed`, err);
    }
    const intervalHours = def.trigger.kind === "schedule" ? def.trigger.intervalHours : 24;
    await saveExistingScript(ctx, def, {
      scheduleNextRunAt: new Date(Date.now() + intervalHours * HOUR_MS),
    });
  }
}

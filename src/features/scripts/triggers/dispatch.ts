/**
 * Runs a stored script outside an interaction (scheduled or event-driven).
 *
 * No human is present to confirm, so the plan is applied for real with the
 * script's declared capabilities. If the script has a report channel, the run
 * summary is posted there; otherwise the outcome is only logged.
 */
import type { Client } from "discord.js";
import type { ScriptDefinitionValue } from "@/components/script-definition";
import { createLogger } from "@/core/logger";
import { v2Message } from "@/ui/v2";
import { executeRunnable } from "../run";

const log = createLogger("scripts:trigger");

export async function dispatchScript(
  client: Client,
  def: ScriptDefinitionValue,
  options: { invoker?: { id: string; tag: string } | null } = {},
): Promise<void> {
  if (!def.enabled) return;
  const guild = client.guilds.cache.get(def.guildId);
  if (!guild) return;

  const presented = await executeRunnable(
    guild,
    { kind: "stored", def },
    { dryRun: false, invoker: options.invoker ?? null },
  );

  if (!def.reportChannelId) return;
  const channel = await guild.channels.fetch(def.reportChannelId).catch(() => null);
  if (channel?.isTextBased() && "send" in channel) {
    await channel
      .send(v2Message(presented.container))
      .catch((err) => log.warn(`Failed to post report for ${def.name}`, err));
  }
}

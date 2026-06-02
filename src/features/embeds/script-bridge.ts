/**
 * Bridges an embed config to the shared scripting engine.
 *
 * Builds the embed-flavoured `ScriptContext`, runs the stored script, and hands
 * back the validated `ScriptOutput` for the embed builder to merge. A disabled
 * or failing script yields `null` — the static embed is rendered regardless.
 */
import { createLogger } from "@/core/logger";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { runScript, type ScriptContext, type ScriptOutput } from "@/features/scripts/engine";

const log = createLogger("embeds:script-bridge");

export async function runEmbedScript(
  config: EmbedConfig,
  channel: { id: string; name: string },
  guild: { id: string; name: string; memberCount: number },
): Promise<ScriptOutput | null> {
  if (!config.scriptEnabled || config.script === null) return null;

  const ctx: ScriptContext = {
    guild: { id: guild.id, name: guild.name, memberCount: guild.memberCount },
    channel,
    timestamp: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toISOString().slice(11, 16),
  };

  try {
    return await runScript(config.script, ctx);
  } catch (err) {
    log.warn("Script execution failed", err);
    return null;
  }
}

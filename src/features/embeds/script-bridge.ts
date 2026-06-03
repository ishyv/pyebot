/**
 * Bridges an embed config to the shared scripting engine.
 *
 * An embed script is TypeScript (a function body) run with a **read-only** ctx
 * (no capabilities → no mutating recorders), returning an embed-shaped record
 * that the builder merges. A disabled, failing, or wrong-shaped script yields
 * `null` — the static embed renders regardless.
 *
 * Embeds don't fetch the member list (this runs on the sticky/scheduled hot
 * path), so the snapshot's members/roles/channels are empty; scripts get
 * `ctx.guild` (incl. memberCount), `ctx.channel`, and `ctx.now`.
 */
import { z } from "zod";
import { createLogger } from "@/core/logger";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { execute, type ScriptSnapshot } from "@/features/scripts/engine";

const log = createLogger("embeds:script-bridge");

const EmbedScriptOutputSchema = z.object({
  title: z.string().max(256).nullable().optional(),
  description: z.string().max(4096).nullable().optional(),
  color: z.number().int().nullable().optional(),
  footer: z.string().max(2048).nullable().optional(),
  fields: z
    .array(
      z.object({
        name: z.string().max(256),
        value: z.string().max(1024),
        inline: z.boolean().optional(),
      }),
    )
    .optional(),
});

export type EmbedScriptOutput = z.infer<typeof EmbedScriptOutputSchema>;

export async function runEmbedScript(
  config: EmbedConfig,
  channel: { id: string; name: string },
  guild: { id: string; name: string; memberCount: number },
): Promise<EmbedScriptOutput | null> {
  if (!config.scriptEnabled || config.script === null) return null;

  const snapshot: ScriptSnapshot = {
    guild: { id: guild.id, name: guild.name, memberCount: guild.memberCount },
    channel,
    invoker: null,
    members: [],
    roles: [],
    channels: [],
    now: Date.now(),
    input: {},
  };

  try {
    const { value } = await execute(config.script, snapshot, []);
    const parsed = EmbedScriptOutputSchema.safeParse(value);
    if (!parsed.success) {
      log.warn("Embed script returned an invalid shape", parsed.error);
      return null;
    }
    return parsed.data;
  } catch (err) {
    log.warn("Script execution failed", err);
    return null;
  }
}

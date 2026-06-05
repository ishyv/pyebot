/**
 * The single storage boundary for stored scripts. Everything else in the
 * feature reads and writes scripts through these helpers, so the entity-model
 * details (the `GuildScripts` map on the guild document) live in exactly one
 * place.
 *
 * Per-guild reads (`getStoredScript`, `listGuildScripts`, `findEventScripts`)
 * are single-document reads. The scheduler's `findDueScheduledScripts` is the
 * one inherently cross-guild query and scans every guild's script map.
 */

import { Guild } from "@/components/entities";
import { GuildScripts, type ScriptDefinitionValue } from "@/components/script-definition";
import type { Ctx } from "@/framework/types";

/** A guild's whole script map, keyed by name. */
async function readEntries(
  ctx: Ctx,
  guildId: string,
): Promise<Record<string, ScriptDefinitionValue>> {
  return (await ctx.of(Guild, guildId).get(GuildScripts)).entries;
}

async function writeEntry(ctx: Ctx, guildId: string, value: ScriptDefinitionValue): Promise<void> {
  await ctx
    .of(Guild, guildId)
    .update(GuildScripts, (s) => ({ entries: { ...s.entries, [value.name]: value } }));
}

export async function getStoredScript(
  ctx: Ctx,
  guildId: string,
  name: string,
): Promise<ScriptDefinitionValue | null> {
  return (await readEntries(ctx, guildId))[name] ?? null;
}

/** Create or replace a script wholesale. */
export async function putScript(ctx: Ctx, value: ScriptDefinitionValue): Promise<void> {
  await writeEntry(ctx, value.guildId, value);
}

export async function deleteStoredScript(ctx: Ctx, guildId: string, name: string): Promise<void> {
  await ctx.of(Guild, guildId).update(GuildScripts, (s) => {
    const entries = { ...s.entries };
    delete entries[name];
    return { entries };
  });
}

export async function listGuildScripts(
  ctx: Ctx,
  guildId: string,
): Promise<ScriptDefinitionValue[]> {
  return Object.values(await readEntries(ctx, guildId));
}

/** Enabled event-bound scripts for one guild and event. */
export async function findEventScripts(
  ctx: Ctx,
  guildId: string,
  event: string,
): Promise<ScriptDefinitionValue[]> {
  return (await listGuildScripts(ctx, guildId)).filter(
    (s) => s.enabled && s.trigger.kind === "event" && s.trigger.event === event,
  );
}

/** Enabled scheduled scripts due at or before `now`, across every guild. */
export async function findDueScheduledScripts(
  ctx: Ctx,
  now: Date,
): Promise<ScriptDefinitionValue[]> {
  const rows = await ctx.select(GuildScripts).run();
  const due: ScriptDefinitionValue[] = [];
  for (const { value } of rows) {
    for (const script of Object.values(value.entries)) {
      if (
        script.enabled &&
        script.trigger.kind === "schedule" &&
        script.scheduleNextRunAt !== null &&
        script.scheduleNextRunAt <= now
      ) {
        due.push(script);
      }
    }
  }
  return due;
}

/**
 * Persists a partial update to an already-loaded script. Script documents have
 * required creation fields, so callers must merge from the current value rather
 * than relying on default-backed upserts.
 */
export async function saveExistingScript(
  ctx: Ctx,
  current: ScriptDefinitionValue,
  patch: Partial<ScriptDefinitionValue>,
): Promise<ScriptDefinitionValue> {
  const next = { ...current, ...patch };
  await writeEntry(ctx, next.guildId, next);
  return next;
}

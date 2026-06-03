/**
 * A stored, guild-authored script.
 *
 * Scripts are TypeScript source authored from Discord or the webapp, run by the
 * scripting engine (`src/features/scripts/engine`). `capabilities` is the set of
 * mutating powers the script was granted; the engine only exposes the matching
 * recorders on `ctx`. Keyed `{guildId}:{name}` via `scriptId`.
 */
import { z } from "zod";
import { component } from "@/framework/component";

// Mirrors the engine's `Capability` union (kept as literals because Zod enums
// need them). The two must stay in sync.
export const SCRIPT_CAPABILITIES = ["roles", "messaging", "channels"] as const;

/** Discord events a script can bind to. Our own names, mapped to discord.js in triggers/events.ts. */
export const SCRIPT_EVENTS = ["member-join"] as const;
export type ScriptEvent = (typeof SCRIPT_EVENTS)[number];

const TriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }),
  z.object({ kind: z.literal("schedule"), intervalHours: z.number().int().min(1).max(168) }),
  z.object({ kind: z.literal("event"), event: z.enum(SCRIPT_EVENTS) }),
]);

export const ScriptDefinition = component({
  collection: "scripts",
  schema: z.object({
    guildId: z.string(),
    name: z.string().max(64),
    description: z.string().max(200).default(""),
    source: z.string().max(10_000),
    capabilities: z.array(z.enum(SCRIPT_CAPABILITIES)).default([]),
    /** How the script runs. Manual = only `/script run`. */
    trigger: TriggerSchema.default({ kind: "manual" }),
    /** Where scheduled/event run summaries are posted, if anywhere. */
    reportChannelId: z.string().nullable().default(null),
    /** Next due time for a scheduled trigger; null for manual/event. */
    scheduleNextRunAt: z.coerce.date().nullable().default(null),
    createdBy: z.string(),
    enabled: z.boolean().default(true),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
  }),
});

export type ScriptDefinitionValue = z.infer<typeof ScriptDefinition.schema>;
export type ScriptTrigger = ScriptDefinitionValue["trigger"];

/** Stable id for one guild's named script. */
export function scriptId(guildId: string, name: string): string {
  return `${guildId}:${name}`;
}

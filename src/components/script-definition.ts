/**
 * Guild-authored scripts, stored as a map on the owning guild's entity document.
 *
 * Scripts are TypeScript source authored from Discord or the webapp, run by the
 * scripting engine (`src/features/scripts/engine`). `capabilities` is the set of
 * mutating powers the script was granted; the engine only exposes the matching
 * recorders on `ctx`.
 *
 * One `GuildScripts.entries` map per guild, keyed by script name. The map key
 * replaces the old `{guildId}:{name}` document id; `guildId` and `name` stay on
 * each entry (denormalized) so the value passed to the engine/dispatch is the
 * same shape it always was. All storage access goes through
 * `src/features/scripts/persistence.ts` — feature code never touches the
 * component directly.
 */
import { z } from "zod";
import { Guild } from "@/components/entities";
import { defineComponent } from "@/framework";

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

export const ScriptSchema = z.object({
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
});

export type ScriptDefinitionValue = z.infer<typeof ScriptSchema>;
export type ScriptTrigger = ScriptDefinitionValue["trigger"];

export const GuildScripts = defineComponent(
  Guild,
  "scripts",
  z.object({
    /** scriptName → its definition. */
    entries: z.record(z.string(), ScriptSchema).default(() => ({})),
  }),
);
export type GuildScriptsValue = z.infer<typeof GuildScripts.schema>;

/** Stable id for one guild's named script (used for log lines and engine ids). */
export function scriptId(guildId: string, name: string): string {
  return `${guildId}:${name}`;
}

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

export const ScriptDefinition = component({
  collection: "scripts",
  schema: z.object({
    guildId: z.string(),
    name: z.string().max(64),
    description: z.string().max(200).default(""),
    source: z.string().max(10_000),
    capabilities: z.array(z.enum(SCRIPT_CAPABILITIES)).default([]),
    createdBy: z.string(),
    enabled: z.boolean().default(true),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
  }),
});

export type ScriptDefinitionValue = z.infer<typeof ScriptDefinition.schema>;

/** Stable id for one guild's named script. */
export function scriptId(guildId: string, name: string): string {
  return `${guildId}:${name}`;
}

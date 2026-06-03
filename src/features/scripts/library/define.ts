/**
 * Static, in-source scripts.
 *
 * Unlike stored scripts (TS text run in a worker), a library script is real
 * TypeScript compiled with the bot: typed against `ScriptApi`, always present,
 * and trusted — so it runs in-process (no transpile, no worker). It still uses
 * the same `ctx` + operation-recording model, so its mutations flow through the
 * same applier and capability gating.
 */
import type { Capability, ScriptApi } from "../engine";

export interface StaticScript {
  readonly name: string;
  readonly description: string;
  readonly capabilities: Capability[];
  run(ctx: ScriptApi): unknown | Promise<unknown>;
}

/** Identity helper that fixes the `StaticScript` shape for a library module. */
export function defineScript(def: StaticScript): StaticScript {
  return def;
}

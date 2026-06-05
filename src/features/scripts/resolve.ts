/**
 * Resolves a script name to something runnable: a built-in takes precedence
 * over a stored script (create/edit guard against shadowing a built-in name, so
 * in practice they never collide).
 */
import type { Ctx } from "@/framework/types";
import { LIBRARY_SCRIPTS } from "./library";
import { getStoredScript } from "./persistence";
import type { Runnable } from "./run";

export async function resolveRunnable(
  ctx: Ctx,
  guildId: string,
  name: string,
): Promise<Runnable | null> {
  const builtin = LIBRARY_SCRIPTS.get(name);
  if (builtin) return { kind: "library", script: builtin };

  const def = await getStoredScript(ctx, guildId, name);
  return def ? { kind: "stored", def } : null;
}

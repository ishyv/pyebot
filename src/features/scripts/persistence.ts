import { ScriptDefinition, type ScriptDefinitionValue } from "@/components/script-definition";
import type { Ctx } from "@/framework/types";

/**
 * Persists an already-created stored script without invoking default-backed
 * upsert behavior. Script documents have required creation fields, so callers
 * must load the current document first and merge updates from that boundary.
 */
export async function saveExistingScript(
  ctx: Ctx,
  id: string,
  current: ScriptDefinitionValue,
  patch: Partial<ScriptDefinitionValue>,
): Promise<ScriptDefinitionValue> {
  const next = { ...current, ...patch };
  await ctx.set(id, ScriptDefinition, next);
  return next;
}

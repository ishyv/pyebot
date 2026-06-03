/**
 * Public surface of the scripting engine.
 *
 * Other features depend only on this barrel, never on the engine internals.
 * Keep the export list small and intentional.
 *
 * `runScript`/`ScriptContext`/`ScriptOutput` are the LEGACY embed-only path
 * (raw function expression -> embed fields). Embeds still use it until the
 * Phase 5 rewire, after which `runner.ts`/`worker.ts` are removed.
 *
 * The collect-then-apply path (`execute` + `applyOperations`) is the general
 * engine: TS source -> { value, operations } -> applied against the guild.
 */

export {
  buildContext,
  type Capability,
  type ChannelSnapshot,
  type MemberSnapshot,
  type MemberView,
  type RoleSnapshot,
  type ScriptApi,
  type ScriptSnapshot,
} from "./api";
export {
  type ApplyOptions,
  type ApplyReport,
  applyOperations,
  type OperationResult,
} from "./apply";
export { type ExecuteOptions, type ExecutionResult, execute } from "./execute";
export { type Operation, OperationSchema, OperationsSchema } from "./operations";
export { type RunScriptOptions, runScript, type ScriptContext, type ScriptOutput } from "./runner";

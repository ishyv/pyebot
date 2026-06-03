/**
 * Public surface of the scripting engine.
 *
 * Other features depend only on this barrel, never on the engine internals.
 * Keep the export list small and intentional.
 *
 * The engine is collect-then-apply: TS source -> { value, operations } via
 * `execute` (worker) or `buildContext` (in-process), then `applyOperations`
 * against the guild.
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

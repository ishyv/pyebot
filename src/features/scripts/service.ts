/**
 * Orchestrates a single script run: snapshot -> execute -> apply.
 *
 * The engine produces a `{ value, operations }` plan; this layer applies that
 * plan against the guild (or dry-runs it) and returns both the script's value
 * and the apply report. Script errors (compile/runtime/timeout/budget) throw;
 * per-operation failures are captured in the report, not thrown.
 */
import type { Guild } from "discord.js";
import {
  type ApplyReport,
  applyOperations,
  type Capability,
  execute,
  type Operation,
} from "./engine";
import { buildSnapshot, type SnapshotContext } from "./snapshot";

export interface RunOptions extends SnapshotContext {
  /** Validate + report without performing any mutation. */
  readonly dryRun?: boolean;
  readonly timeoutMs?: number;
  readonly maxOperations?: number;
}

export interface RunResult {
  readonly value: unknown;
  readonly operations: Operation[];
  readonly report: ApplyReport;
}

export async function runSource(
  guild: Guild,
  source: string,
  capabilities: Capability[],
  options: RunOptions = {},
): Promise<RunResult> {
  const snapshot = await buildSnapshot(guild, {
    channel: options.channel,
    invoker: options.invoker,
  });

  const { value, operations } = await execute(source, snapshot, capabilities, {
    timeoutMs: options.timeoutMs,
    maxOperations: options.maxOperations,
  });

  const report = await applyOperations(guild, operations, { dryRun: options.dryRun });
  return { value, operations, report };
}

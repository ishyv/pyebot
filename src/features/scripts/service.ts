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
  buildContext,
  type Capability,
  execute,
  type Operation,
} from "./engine";
import type { StaticScript } from "./library/define";
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
    input: options.input,
  });

  const { value, operations } = await execute(source, snapshot, capabilities, {
    timeoutMs: options.timeoutMs,
    maxOperations: options.maxOperations,
  });

  const report = await applyOperations(guild, operations, { dryRun: options.dryRun });
  return { value, operations, report };
}

/**
 * Runs a trusted in-source script. Same snapshot/operation/apply path as
 * `runSource`, but the script function runs in-process — no worker, no
 * transpile — since library code is compiled with the bot.
 */
export async function runStatic(
  guild: Guild,
  script: StaticScript,
  options: RunOptions = {},
): Promise<RunResult> {
  const snapshot = await buildSnapshot(guild, {
    channel: options.channel,
    invoker: options.invoker,
    input: options.input,
  });

  const maxOperations = options.maxOperations ?? 1000;
  const operations: Operation[] = [];
  const ctx = buildContext(snapshot, new Set(script.capabilities), (op) => {
    if (operations.length >= maxOperations) {
      throw new Error(`Operation budget exceeded (max ${maxOperations})`);
    }
    operations.push(op);
  });

  const value = await script.run(ctx);
  const report = await applyOperations(guild, operations, { dryRun: options.dryRun });
  return { value, operations, report };
}

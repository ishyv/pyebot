/**
 * Runs a stored script and renders the outcome as a V2 container.
 *
 * Shared by `/script run` (which dry-runs first) and the confirm-apply button
 * (which runs for real). Errors are caught and rendered, never thrown, so the
 * caller always gets something to show.
 */
import type { ContainerBuilder, Guild } from "discord.js";
import type { ScriptDefinitionValue } from "@/components/script-definition";
import { container, text } from "@/ui/v2";
import type { Operation } from "./engine";
import type { StaticScript } from "./library/define";
import { type RunResult, runSource, runStatic } from "./service";
import type { SnapshotContext } from "./snapshot";

/** A script ready to run: either guild-authored (stored) or a built-in. */
export type Runnable =
  | { readonly kind: "stored"; readonly def: ScriptDefinitionValue }
  | { readonly kind: "library"; readonly script: StaticScript };

export function runnableName(runnable: Runnable): string {
  return runnable.kind === "stored" ? runnable.def.name : runnable.script.name;
}

export interface PresentedRun {
  readonly container: ContainerBuilder;
  readonly operationCount: number;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function summarizeKinds(operations: readonly Operation[]): string {
  const counts = new Map<string, number>();
  for (const op of operations) counts.set(op.kind, (counts.get(op.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => `${n}× ${kind}`).join(", ");
}

export async function executeRunnable(
  guild: Guild,
  runnable: Runnable,
  options: { dryRun: boolean } & SnapshotContext,
): Promise<PresentedRun> {
  const name = runnableName(runnable);
  const run = (): Promise<RunResult> =>
    runnable.kind === "stored"
      ? runSource(guild, runnable.def.source, runnable.def.capabilities, {
          dryRun: options.dryRun,
          invoker: options.invoker,
          channel: options.channel,
        })
      : runStatic(guild, runnable.script, {
          dryRun: options.dryRun,
          invoker: options.invoker,
          channel: options.channel,
        });

  let result: RunResult;
  try {
    result = await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      container: container("danger", text(`## \`${name}\` failed\n${truncate(message, 500)}`)),
      operationCount: 0,
    };
  }

  const lines: string[] = [];
  if (result.value !== null && result.value !== undefined) {
    const display =
      typeof result.value === "string"
        ? truncate(result.value, 1800)
        : `\`${truncate(JSON.stringify(result.value), 300)}\``;
    lines.push(`**Result:**\n${display}`);
  }

  if (result.operations.length === 0) {
    lines.push("_No operations._");
  } else {
    lines.push(
      `**Plan:** ${result.operations.length} operation(s) — ${summarizeKinds(result.operations)}`,
    );
    if (result.report.dryRun) {
      lines.push("-# Dry run — nothing was applied. Confirm below to apply.");
    } else {
      lines.push(`**Applied:** ${result.report.applied} • **Failed:** ${result.report.failed}`);
      for (const r of result.report.results.filter((x) => !x.ok).slice(0, 5)) {
        lines.push(`• ✗ ${r.operation.kind}: ${truncate(r.error ?? "unknown error", 120)}`);
      }
    }
  }

  const accent = result.report.failed > 0 ? "warn" : "ok";
  return {
    container: container(accent, text(`## \`${name}\`\n${lines.join("\n")}`)),
    operationCount: result.operations.length,
  };
}

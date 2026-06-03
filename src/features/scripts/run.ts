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
import { runSource } from "./service";
import type { SnapshotContext } from "./snapshot";

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

export async function executeStoredScript(
  guild: Guild,
  def: ScriptDefinitionValue,
  options: { dryRun: boolean } & SnapshotContext,
): Promise<PresentedRun> {
  let result: Awaited<ReturnType<typeof runSource>>;
  try {
    result = await runSource(guild, def.source, def.capabilities, {
      dryRun: options.dryRun,
      invoker: options.invoker,
      channel: options.channel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      container: container("danger", text(`## \`${def.name}\` failed\n${truncate(message, 500)}`)),
      operationCount: 0,
    };
  }

  const lines: string[] = [];
  if (result.value !== null && result.value !== undefined) {
    lines.push(`**Result:** \`${truncate(JSON.stringify(result.value), 300)}\``);
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
    container: container(accent, text(`## \`${def.name}\`\n${lines.join("\n")}`)),
    operationCount: result.operations.length,
  };
}

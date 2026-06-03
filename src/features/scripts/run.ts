/**
 * Runs a stored script and renders the outcome as a V2 container.
 *
 * Shared by `/script run` (which dry-runs first) and the confirm-apply button
 * (which runs for real). Errors are caught and rendered, never thrown, so the
 * caller always gets something to show.
 */
import type { ContainerBuilder, Guild } from "discord.js";
import type { ScriptDefinitionValue } from "@/components/script-definition";
import { type ContainerChild, container, separator, text } from "@/ui/v2";
import type { InputField, Operation, OutputAccent, OutputItem, OutputToken } from "./engine";
import { isOutputArray, isOutputToken, scanInputs } from "./engine";
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

let _transpiler: Bun.Transpiler | null = null;
function transpile(source: string): string {
  _transpiler ??= new Bun.Transpiler({ loader: "ts" });
  return _transpiler.transformSync(source);
}

/**
 * Returns the declared input fields for a runnable. Library scripts have no
 * dynamic inputs (they're compiled and parametrised by snapshot data).
 */
export function scanInputsFromRunnable(runnable: Runnable): InputField[] {
  if (runnable.kind !== "stored") return [];
  try {
    return scanInputs(transpile(runnable.def.source));
  } catch {
    return [];
  }
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function summarizeKinds(operations: readonly Operation[]): string {
  const counts = new Map<string, number>();
  for (const op of operations) counts.set(op.kind, (counts.get(op.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => `${n}× ${kind}`).join(", ");
}

function formatStringArray(items: readonly string[]): string {
  const visible = items.slice(0, 25);
  const rest = items.length - visible.length;
  const lines = visible.map((s) => `• ${s}`);
  if (rest > 0) lines.push(`-# …and ${rest} more`);
  return lines.join("\n");
}

function formatObject(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).slice(0, 10);
  const rest = Object.keys(obj).length - entries.length;
  const lines = entries.map(([k, v]) => `**${k}** — ${String(v)}`);
  if (rest > 0) lines.push(`-# …and ${rest} more`);
  return lines.join("\n");
}

/**
 * Converts a script return value into a list of Discord container children
 * (alternating `text()` blocks and `separator("lg")` dividers) plus a resolved
 * accent. Handles both the typed `OutputItem[]` DSL and plain primitives/objects.
 */
function renderOutput(
  value: unknown,
  baseAccent: OutputAccent,
): { accent: OutputAccent; children: ContainerChild[] } {
  let accent = baseAccent;
  const children: ContainerChild[] = [];
  let pendingLines: string[] = [];

  function flushLines(): void {
    const content = pendingLines.join("\n").trim();
    if (content) children.push(text(content));
    pendingLines = [];
  }

  function pushSep(): void {
    flushLines();
    if (children.length > 0) children.push(separator("lg"));
  }

  function processToken(token: OutputToken): void {
    switch (token._t) {
      case "title":
        pendingLines.push(`## ${token.text}`);
        break;
      case "color":
        accent = token.accent;
        break;
      case "sep":
        pushSep();
        break;
      case "footer":
        pendingLines.push(`-# ${token.text}`);
        break;
      case "display":
        pendingLines.push(token.content);
        break;
      case "field":
        pendingLines.push(`**${token.name}** — ${token.value}`);
        break;
    }
  }

  function processItem(item: OutputItem): void {
    if (isOutputToken(item)) {
      processToken(item);
      return;
    }
    if (Array.isArray(item)) {
      pendingLines.push(formatStringArray(item as string[]));
      return;
    }
    if (typeof item === "object" && item !== null) {
      pendingLines.push(formatObject(item as Record<string, unknown>));
      return;
    }
    if (typeof item === "string") {
      pendingLines.push(truncate(item, 1800));
      return;
    }
    // number, boolean, etc.
    pendingLines.push(String(item));
  }

  if (value === null || value === undefined) {
    // no value section
  } else if (isOutputArray(value)) {
    for (const item of value as OutputItem[]) processItem(item);
  } else if (Array.isArray(value)) {
    pendingLines.push(formatStringArray(value as string[]));
  } else if (typeof value === "object") {
    pendingLines.push(formatObject(value as Record<string, unknown>));
  } else {
    pendingLines.push(truncate(String(value), 1800));
  }

  flushLines();
  return { accent, children };
}

function opsText(result: RunResult): string {
  if (result.operations.length === 0) return "_No operations._";
  const lines: string[] = [
    `**Plan:** ${result.operations.length} operation(s) — ${summarizeKinds(result.operations)}`,
  ];
  if (result.report.dryRun) {
    lines.push("-# Dry run — nothing was applied. Confirm below to apply.");
  } else {
    lines.push(`**Applied:** ${result.report.applied} • **Failed:** ${result.report.failed}`);
    for (const r of result.report.results.filter((x) => !x.ok).slice(0, 5)) {
      lines.push(`• ✗ ${r.operation.kind}: ${truncate(r.error ?? "unknown error", 120)}`);
    }
  }
  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function executeRunnable(
  guild: Guild,
  runnable: Runnable,
  options: { dryRun: boolean; input?: Record<string, string> } & SnapshotContext,
): Promise<PresentedRun> {
  const name = runnableName(runnable);
  const run = (): Promise<RunResult> =>
    runnable.kind === "stored"
      ? runSource(guild, runnable.def.source, runnable.def.capabilities, {
          dryRun: options.dryRun,
          invoker: options.invoker,
          channel: options.channel,
          input: options.input,
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

  const baseAccent: OutputAccent = result.report.failed > 0 ? "warn" : "ok";
  const { accent, children } = renderOutput(result.value, baseAccent);
  const ops = opsText(result);

  const headerText = text(`## \`${name}\``);
  const allChildren: ContainerChild[] =
    children.length > 0
      ? [headerText, separator("lg"), ...children, separator("lg"), text(ops)]
      : [headerText, separator("lg"), text(ops)];

  return {
    container: container(accent, ...allChildren),
    operationCount: result.operations.length,
  };
}

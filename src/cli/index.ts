import { parseTxCliArgs, TxCliUsageError } from "./args";
import { checkAuthoring } from "./check";
import { nodeFileSystem } from "./fs";
import { runImageCommand } from "./image";
import { planScaffold } from "./scaffold";
import type { CliFileSystem, FilePlan, ImageCliCommand, TxCliResult } from "./types";

export { parseTxCliArgs, TxCliUsageError } from "./args";
export { checkAuthoring } from "./check";
export { nodeFileSystem } from "./fs";
export { planScaffold } from "./scaffold";
export type {
  CliFileSystem,
  FilePlan,
  PlannedFile,
  TxCliCommand,
  TxCliResult,
} from "./types";

export interface RunTxCliDependencies {
  readonly fs?: CliFileSystem;
  runImage?(command: ImageCliCommand): Promise<void>;
}

/** Main testable CLI entrypoint. It returns printable output instead of exiting. */
export async function runTxCli(
  argv: readonly string[],
  dependencies: RunTxCliDependencies = {},
): Promise<TxCliResult> {
  const fs = dependencies.fs ?? nodeFileSystem();
  const runImage = dependencies.runImage ?? runImageCommand;

  try {
    const command = parseTxCliArgs(argv);
    if (command.kind === "help") return ok(usage());
    if (command.kind === "image") {
      await runImage(command);
      return ok("");
    }
    if (command.kind === "check-authoring") return renderAuthoringCheck();

    const plan = await planScaffold(command, fs);
    if (command.dryRun) return ok(renderFilePlan(plan, "Would write"));

    await applyFilePlan(plan, fs);
    return ok(renderFilePlan(plan, "Wrote"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const includeUsage = error instanceof TxCliUsageError;
    return {
      stdout: "",
      stderr: includeUsage ? `${message}\n\n${usage()}` : message,
      exitCode: 1,
    };
  }
}

/** Writes a planned scaffold after checking collisions again at the boundary. */
export async function applyFilePlan(plan: FilePlan, fs: CliFileSystem): Promise<void> {
  for (const file of plan.files) {
    if (await fs.exists(file.path))
      throw new Error(`Refusing to overwrite existing file: ${file.path}`);
    await fs.writeFile(file.path, file.content);
  }
}

function renderFilePlan(plan: FilePlan, verb: string): string {
  return [
    ...plan.files.map((file) => `${verb} ${file.path}`),
    ...plan.notes.map((note) => note),
  ].join("\n");
}

async function renderAuthoringCheck(): Promise<TxCliResult> {
  const report = await checkAuthoring();
  const lines = report.checks.map((check) => {
    const marker = check.status === "pass" ? "PASS" : "FAIL";
    return `[${marker}] ${check.id}: ${check.message}`;
  });
  return {
    stdout: lines.join("\n"),
    stderr: "",
    exitCode: report.ok ? 0 : 1,
  };
}

function ok(stdout: string): TxCliResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function usage(): string {
  return [
    "Usage:",
    "  tx new feature --id <id> --name <name> --description <text> [--default-enabled true|false] [--dry-run]",
    "  tx new command --feature <id> --name <name> --description <text> [--admin] [--hidden] [--dry-run]",
    "  tx new handler --feature <id> --kind listen|handle|on [--event <name>] [--prefix <custom-id-prefix>] [--method <name>] [--dry-run]",
    "  tx new config --feature <id> --field <key> --kind channel|boolean|number|string|select --label <text> --path <guild.path> [--required] [--option value:Label] [--dry-run]",
    "  tx check authoring",
    "  tx image add <path> --guild <id> --reason <text> [--label <text>] [--actor <id>]",
    "  tx image test <path> --guild <id> [--tolerance strict|balanced|loose]",
    "  tx image remove <id-or-path> --guild <id> [--actor <id>]",
    "  tx image edit <id-or-path> --guild <id> [--reason <text>] [--label <text>]",
    "",
    "Env fallbacks:",
    "  TX_GUILD_ID or GUILD_ID for --guild",
    "  TX_ACTOR_ID for --actor",
  ].join("\n");
}

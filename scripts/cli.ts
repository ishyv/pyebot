/**
 * Executable wrapper for the local `tx` CLI.
 *
 * CLI behavior lives in `src/cli` so parsing, scaffolding, checks, and legacy
 * image dispatch can be tested without invoking a process or touching disk.
 */

import "dotenv/config";
import { nodeFileSystem, runTxCli } from "@/cli";
import { disconnectDb } from "@/core/db";

const result = await runTxCli(process.argv.slice(2), {
  fs: nodeFileSystem(process.cwd()),
});

if (result.stdout) console.log(result.stdout);
if (result.stderr) console.error(result.stderr);
process.exitCode = result.exitCode;

await disconnectDb().catch(() => {});

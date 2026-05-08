import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createDoctorReport,
  currentBunVersion,
  type DoctorStatus,
  loadEnvFile,
} from "@/framework/doctor";

const cwd = process.cwd();
const env = { ...process.env, ...loadEnvFile(cwd) };
const report = createDoctorReport({
  bunVersion: currentBunVersion(),
  env,
  nodeModulesPresent: existsSync(join(cwd, "node_modules")),
  lockfilePresent: existsSync(join(cwd, "bun.lock")),
});

console.log("tx-v2 doctor\n");

for (const check of report.checks) {
  console.log(`${marker(check.status)} ${check.label}: ${check.message}`);
  if (check.fix) console.log(`   fix: ${check.fix}`);
}

if (!report.ok) {
  console.log("\nStartup prerequisites are missing.");
  process.exit(1);
}

console.log("\nDoctor checks passed with no blocking failures.");

function marker(status: DoctorStatus): string {
  switch (status) {
    case "pass":
      return "[pass]";
    case "warn":
      return "[warn]";
    case "fail":
      return "[fail]";
  }
}

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  readonly id: string;
  readonly label: string;
  readonly status: DoctorStatus;
  readonly message: string;
  readonly fix?: string;
}

export interface DoctorInput {
  readonly bunVersion: string | null;
  readonly env: Record<string, string | undefined>;
  readonly nodeModulesPresent: boolean;
  readonly lockfilePresent: boolean;
}

export interface DoctorReport {
  readonly ok: boolean;
  readonly checks: readonly DoctorCheck[];
}

const MIN_BUN_VERSION = "1.1.0";

export function createDoctorReport(input: DoctorInput): DoctorReport {
  const checks = [
    checkBun(input.bunVersion),
    checkLockfile(input.lockfilePresent),
    checkInstall(input.nodeModulesPresent),
    checkToken(input.env),
    checkClientId(input.env),
    checkMongo(input.env),
  ];

  return {
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

export function loadEnvFile(cwd = process.cwd()): Record<string, string> {
  const path = join(cwd, ".env");
  if (!existsSync(path)) return {};

  const out: Record<string, string> = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    out[key] = stripEnvQuotes(raw);
  }
  return out;
}

export function currentBunVersion(): string | null {
  const runtime = globalThis as typeof globalThis & { Bun?: { version?: string } };
  return runtime.Bun?.version ?? null;
}

function checkBun(version: string | null): DoctorCheck {
  if (!version) {
    return {
      id: "bun",
      label: "Bun runtime",
      status: "fail",
      message: "Bun is not available on PATH.",
      fix: "Install Bun 1.1.0 or newer, then reopen the terminal.",
    };
  }

  if (compareVersions(version, MIN_BUN_VERSION) < 0) {
    return {
      id: "bun",
      label: "Bun runtime",
      status: "fail",
      message: `Bun ${version} is older than the supported minimum ${MIN_BUN_VERSION}.`,
      fix: "Upgrade Bun before running the bot.",
    };
  }

  return {
    id: "bun",
    label: "Bun runtime",
    status: "pass",
    message: `Bun ${version} is available.`,
  };
}

function checkLockfile(lockfilePresent: boolean): DoctorCheck {
  return lockfilePresent
    ? {
        id: "lockfile",
        label: "Dependency lockfile",
        status: "pass",
        message: "bun.lock is present.",
      }
    : {
        id: "lockfile",
        label: "Dependency lockfile",
        status: "warn",
        message: "bun.lock is missing, so installs may drift.",
        fix: "Run bun install and commit the generated lockfile.",
      };
}

function checkInstall(nodeModulesPresent: boolean): DoctorCheck {
  return nodeModulesPresent
    ? {
        id: "dependencies",
        label: "Dependencies",
        status: "pass",
        message: "node_modules is present.",
      }
    : {
        id: "dependencies",
        label: "Dependencies",
        status: "fail",
        message: "Dependencies are not installed.",
        fix: "Run bun install.",
      };
}

function checkToken(env: Record<string, string | undefined>): DoctorCheck {
  const hasToken = hasValue(env.TOKEN) || hasValue(env.DISCORD_TOKEN);
  return hasToken
    ? {
        id: "discord-token",
        label: "Discord token",
        status: "pass",
        message: "Discord token is configured.",
      }
    : {
        id: "discord-token",
        label: "Discord token",
        status: "fail",
        message: "No Discord bot token was found.",
        fix: "Set TOKEN or DISCORD_TOKEN in .env.",
      };
}

function checkClientId(env: Record<string, string | undefined>): DoctorCheck {
  return hasValue(env.CLIENT_ID)
    ? {
        id: "client-id",
        label: "Discord client ID",
        status: "pass",
        message: "CLIENT_ID is configured.",
      }
    : {
        id: "client-id",
        label: "Discord client ID",
        status: "fail",
        message: "CLIENT_ID is missing.",
        fix: "Set CLIENT_ID in .env so slash commands can be registered intentionally.",
      };
}

function checkMongo(env: Record<string, string | undefined>): DoctorCheck {
  return hasValue(env.MONGO_URI)
    ? {
        id: "mongo",
        label: "MongoDB",
        status: "pass",
        message: "MONGO_URI is configured for persistent storage.",
      }
    : {
        id: "mongo",
        label: "MongoDB",
        status: "warn",
        message:
          "MONGO_URI is not configured; starter bots can use dev storage, but the full bundled bot needs MongoDB.",
        fix: "Set MONGO_URI for production-like persistence.",
      };
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("your_");
}

function stripEnvQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold tx-v2 — a greenfield Discord.js bot project with a working data layer, shared utilities, and Discord client ready for features to be added.

**Architecture:** New project at `../tx-v2/` (sibling to `tx/`). Feature modules in `src/features/`, shared infrastructure in `src/core/` and `src/db/`. Plain exported async functions instead of class-based services. One central state file for all runtime Maps.

**Tech Stack:** Discord.js v14, Bun 1.2, MongoDB native driver 6, Zod 4, TypeScript strict, Biome

---

## File Map

```
tx-v2/
├── package.json
├── tsconfig.json
├── biome.json
├── .env.example
├── .gitignore
└── src/
    ├── index.ts                        # Stub bootstrap
    ├── core/
    │   ├── result.ts                   # Result<T,E> type (port from tx/src/utils/result.ts)
    │   ├── logger.ts                   # createLogger(context) factory
    │   ├── state.ts                    # CooldownManager, SessionManager, LockSet + singletons
    │   ├── db.ts                       # MongoDB singleton (port from tx/src/db/mongo.ts)
    │   └── client.ts                   # Discord.js Client factory
    ├── db/
    │   ├── helpers.ts                  # buildSafeUpsertUpdate etc (port from tx/src/db/helpers.ts)
    │   ├── store.ts                    # MongoStore<T> (port from tx/src/db/mongo-store.ts)
    │   ├── transition.ts               # atomicTransition (port from tx/src/db/atomic-transition.ts)
    │   └── schemas/
    │       ├── user.ts                 # User Zod schema (simplified port)
    │       ├── guild.ts                # Guild Zod schema (port)
    │       └── rpg-profile.ts          # RpgProfile Zod schema (straight port)
    ├── db/repositories/
    │   ├── users.ts                    # User document CRUD (thin MongoStore wrapper)
    │   ├── guilds.ts                   # Guild config CRUD
    │   └── rpg.ts                      # RPG profile CRUD
    └── utils/
        ├── ids.ts                      # Correlation + composite ID builders
        ├── time.ts                     # Cooldown helpers, ms formatting
        ├── currency.ts                 # Format + math helpers
        └── embeds.ts                   # Discord embed builder utilities
```

**Test files** live alongside source: `src/core/result.test.ts`, `src/core/state.test.ts`, etc.

---

## Task 1: Scaffold the project

**Files:**
- Create: `tx-v2/package.json`
- Create: `tx-v2/tsconfig.json`
- Create: `tx-v2/biome.json`
- Create: `tx-v2/.env.example`
- Create: `tx-v2/.gitignore`
- Create: `tx-v2/src/index.ts` (stub)

- [ ] **Step 1: Create the project directory and init git**

```bash
cd C:/Users/Hyvnt/T/Discord
mkdir tx-v2 && cd tx-v2
git init
```

- [ ] **Step 2: Write package.json**

Create `tx-v2/package.json`:
```json
{
  "name": "tx-v2",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "tsc --noEmit",
    "test": "bun test",
    "fmt": "biome format --write .",
    "lint": "biome lint --write .",
    "check": "biome check --write ."
  },
  "dependencies": {
    "discord.js": "^14.16.0",
    "dotenv": "^16.0.0",
    "mongodb": "^6.8.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.1.3",
    "@types/bun": "latest",
    "typescript": "^5.9.0"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

Create `tx-v2/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write biome.json**

Create `tx-v2/biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.1.3/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

- [ ] **Step 5: Write .env.example and .gitignore**

Create `tx-v2/.env.example`:
```
TOKEN=your_discord_bot_token_here
MONGO_URI=mongodb://localhost:27017
DB_NAME=txbot
DEBUG=
```

Create `tx-v2/.gitignore`:
```
node_modules/
dist/
.env
*.log
bun.lock
```

- [ ] **Step 6: Create stub index.ts**

Create `tx-v2/src/index.ts`:
```ts
import "dotenv/config";

async function bootstrap(): Promise<void> {
  console.log("[bootstrap] tx-v2 starting...");
}

bootstrap().catch((err) => {
  console.error("[bootstrap] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 7: Install dependencies**

```bash
cd C:/Users/Hyvnt/T/Discord/tx-v2
bun install
```

Expected: Packages installed, `bun.lock` created.

- [ ] **Step 8: Verify it runs**

```bash
bun src/index.ts
```

Expected output: `[bootstrap] tx-v2 starting...`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold tx-v2 project"
```

---

## Task 2: Result type

**Files:**
- Create: `src/core/result.ts`
- Create: `src/core/result.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/result.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { Ok, Err, OkResult, ErrResult } from "./result";

describe("Ok", () => {
  test("isOk returns true", () => {
    expect(new Ok(42).isOk()).toBe(true);
  });

  test("isErr returns false", () => {
    expect(new Ok(42).isErr()).toBe(false);
  });

  test("unwrap returns value", () => {
    expect(new Ok("hello").unwrap()).toBe("hello");
  });

  test("unwrapOr returns value (ignores default)", () => {
    expect(new Ok(42).unwrapOr(0)).toBe(42);
  });

  test("map transforms value", () => {
    const result = new Ok(2).map((x) => x * 3);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(6);
  });

  test("mapErr is a no-op on Ok", () => {
    const result = new Ok<number, Error>(5).mapErr(() => new Error("x"));
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(5);
  });

  test("inspect calls fn with value", () => {
    let called = false;
    new Ok(1).inspect(() => { called = true; });
    expect(called).toBe(true);
  });

  test("inspectErr does not call fn on Ok", () => {
    let called = false;
    new Ok(1).inspectErr(() => { called = true; });
    expect(called).toBe(false);
  });
});

describe("Err", () => {
  test("isOk returns false", () => {
    expect(new Err(new Error("fail")).isOk()).toBe(false);
  });

  test("isErr returns true", () => {
    expect(new Err(new Error("fail")).isErr()).toBe(true);
  });

  test("unwrap returns undefined and does not throw", () => {
    const result = new Err<number, Error>(new Error("oops")).unwrap();
    expect(result).toBeUndefined();
  });

  test("unwrapOr returns default value", () => {
    expect(new Err<number, Error>(new Error()).unwrapOr(99)).toBe(99);
  });

  test("map is a no-op on Err", () => {
    const result = new Err<number, Error>(new Error("x")).map((x) => x * 2);
    expect(result.isErr()).toBe(true);
  });

  test("mapErr transforms error", () => {
    const result = new Err<number, string>("bad").mapErr((e) => new Error(e));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("bad");
  });

  test("inspect does not call fn on Err", () => {
    let called = false;
    new Err<number, Error>(new Error()).inspect(() => { called = true; });
    expect(called).toBe(false);
  });

  test("inspectErr calls fn with error", () => {
    let called = false;
    new Err(new Error("x")).inspectErr(() => { called = true; });
    expect(called).toBe(true);
  });
});

describe("OkResult / ErrResult factories", () => {
  test("OkResult creates Ok", () => {
    expect(OkResult(42).isOk()).toBe(true);
  });

  test("ErrResult creates Err", () => {
    expect(ErrResult(new Error()).isErr()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd C:/Users/Hyvnt/T/Discord/tx-v2
bun test src/core/result.test.ts
```

Expected: Error — `result.ts` not found.

- [ ] **Step 3: Implement src/core/result.ts**

Create `src/core/result.ts` (straight port from `tx/src/utils/result.ts`):
```ts
export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
  readonly ok = true;
  readonly err = false;

  constructor(public readonly value: T) {}

  isOk(): this is Ok<T, E> { return true; }
  isErr(): this is Err<T, E> { return false; }

  unwrap(): T { return this.value; }
  unwrapOr(_default: T): T { return this.value; }

  map<U>(fn: (value: T) => U): Result<U, E> { return new Ok(fn(this.value)); }
  mapErr<F>(_fn: (error: E) => F): Result<T, F> { return new Ok<T, F>(this.value); }

  inspect(fn: (value: T) => void): Result<T, E> { fn(this.value); return this; }
  inspectErr(_fn: (error: E) => void): Result<T, E> { return this; }
}

export class Err<T, E> {
  readonly ok = false;
  readonly err = true;

  constructor(public readonly error: E) {}

  isOk(): this is Ok<T, E> { return false; }
  isErr(): this is Err<T, E> { return true; }

  /** Does NOT throw. Logs and returns undefined. Caller must check isOk() first. */
  unwrap(): T {
    console.warn("[Result] unwrap called on Err; returning undefined.", this.error);
    return undefined as unknown as T;
  }

  unwrapOr(defaultValue: T): T { return defaultValue; }

  map<U>(_fn: (value: T) => U): Result<U, E> { return new Err<U, E>(this.error); }
  mapErr<F>(fn: (error: E) => F): Result<T, F> { return new Err<T, F>(fn(this.error)); }

  inspect(_fn: (value: T) => void): Result<T, E> { return this; }
  inspectErr(fn: (error: E) => void): Result<T, E> { fn(this.error); return this; }
}

export const OkResult = <T, E = Error>(value: T): Result<T, E> => new Ok(value);
export const ErrResult = <T, E = Error>(error: E): Result<T, E> => new Err(error);
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/core/result.test.ts
```

Expected: All 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/result.ts src/core/result.test.ts
git commit -m "feat: add Result<T,E> type"
```

---

## Task 3: Logger

**Files:**
- Create: `src/core/logger.ts`
- Create: `src/core/logger.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/core/logger.test.ts`:
```ts
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { createLogger } from "./logger";

describe("createLogger", () => {
  beforeEach(() => {
    // Suppress console output during tests
    mock.restore();
  });

  test("returns an object with info, warn, error, debug", () => {
    const logger = createLogger("test");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  test("info calls console.log with context prefix", () => {
    const spy = mock(() => {});
    const orig = console.log;
    console.log = spy;
    const logger = createLogger("MyCtx");
    logger.info("hello");
    console.log = orig;
    expect(spy).toHaveBeenCalledTimes(1);
    const call = (spy.mock.calls[0] as string[])[0] as string;
    expect(call).toContain("[MyCtx]");
    expect(call).toContain("hello");
  });

  test("debug does not log when DEBUG env is not set", () => {
    const orig = process.env.DEBUG;
    delete process.env.DEBUG;
    const spy = mock(() => {});
    const origLog = console.log;
    console.log = spy;
    const logger = createLogger("test");
    logger.debug("hidden");
    console.log = origLog;
    process.env.DEBUG = orig;
    expect(spy).not.toHaveBeenCalled();
  });

  test("debug logs when DEBUG env is set", () => {
    process.env.DEBUG = "1";
    const spy = mock(() => {});
    const origLog = console.log;
    console.log = spy;
    const logger = createLogger("test");
    logger.debug("visible");
    console.log = origLog;
    delete process.env.DEBUG;
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/core/logger.test.ts
```

Expected: Error — `logger.ts` not found.

- [ ] **Step 3: Implement src/core/logger.ts**

Create `src/core/logger.ts`:
```ts
type LogLevel = "info" | "warn" | "error" | "debug";

function timestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, meta?: unknown): void {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}] [${context}]`;
  const out = level === "info" || level === "debug" ? console.log : console[level];
  if (meta !== undefined) {
    out(`${prefix} ${message}`, meta);
  } else {
    out(`${prefix} ${message}`);
  }
}

export function createLogger(context: string) {
  return {
    info: (message: string, meta?: unknown) => log("info", context, message, meta),
    warn: (message: string, meta?: unknown) => log("warn", context, message, meta),
    error: (message: string, meta?: unknown) => log("error", context, message, meta),
    debug: (message: string, meta?: unknown) => {
      if (process.env.DEBUG) log("debug", context, message, meta);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/core/logger.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/logger.ts src/core/logger.test.ts
git commit -m "feat: add createLogger utility"
```

---

## Task 4: CooldownManager

**Files:**
- Create: `src/core/state.ts` (partial — CooldownManager only)
- Create: `src/core/state.test.ts` (partial)

- [ ] **Step 1: Write failing tests**

Create `src/core/state.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { CooldownManager } from "./state";

describe("CooldownManager", () => {
  test("isOnCooldown returns false for unknown user+command", () => {
    const mgr = new CooldownManager();
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("isOnCooldown returns true immediately after set", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user1", "work")).toBe(true);
  });

  test("isOnCooldown returns false after expiry", async () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("getRemainingMs returns positive value before expiry", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.getRemainingMs("user1", "work")).toBeGreaterThan(0);
  });

  test("getRemainingMs returns 0 after expiry", async () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(mgr.getRemainingMs("user1", "work")).toBe(0);
  });

  test("clear removes the cooldown", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    mgr.clear("user1", "work");
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("different commands are independent", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user1", "daily")).toBe(false);
  });

  test("different users are independent", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user2", "work")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/core/state.test.ts
```

Expected: Error — `state.ts` not found.

- [ ] **Step 3: Implement CooldownManager in src/core/state.ts**

Create `src/core/state.ts`:
```ts
export class CooldownManager {
  private readonly map = new Map<string, number>();

  private key(userId: string, command: string): string {
    return `${userId}:${command}`;
  }

  set(userId: string, command: string, durationMs: number): void {
    this.map.set(this.key(userId, command), Date.now() + durationMs);
  }

  isOnCooldown(userId: string, command: string): boolean {
    const expiresAt = this.map.get(this.key(userId, command));
    if (expiresAt === undefined) return false;
    if (Date.now() >= expiresAt) {
      this.map.delete(this.key(userId, command));
      return false;
    }
    return true;
  }

  getRemainingMs(userId: string, command: string): number {
    const expiresAt = this.map.get(this.key(userId, command));
    if (expiresAt === undefined) return 0;
    return Math.max(0, expiresAt - Date.now());
  }

  clear(userId: string, command: string): void {
    this.map.delete(this.key(userId, command));
  }
}

// Placeholder — SessionManager and LockSet added in Task 5
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/core/state.test.ts
```

Expected: All 8 tests pass.

---

## Task 5: SessionManager + LockSet

**Files:**
- Modify: `src/core/state.ts` (add SessionManager, LockSet, exported singletons)
- Modify: `src/core/state.test.ts` (add tests)

- [ ] **Step 1: Add tests for SessionManager and LockSet**

Append to `src/core/state.test.ts`:
```ts
import { SessionManager, LockSet } from "./state";

describe("SessionManager", () => {
  test("get returns undefined when empty", () => {
    const mgr = new SessionManager<string>();
    expect(mgr.get("key1")).toBeUndefined();
  });

  test("set and get round-trip", () => {
    const mgr = new SessionManager<number>();
    mgr.set("key1", 42);
    expect(mgr.get("key1")).toBe(42);
  });

  test("has returns false when not set", () => {
    const mgr = new SessionManager<string>();
    expect(mgr.has("key1")).toBe(false);
  });

  test("has returns true after set", () => {
    const mgr = new SessionManager<string>();
    mgr.set("key1", "data");
    expect(mgr.has("key1")).toBe(true);
  });

  test("delete removes the entry", () => {
    const mgr = new SessionManager<string>();
    mgr.set("key1", "data");
    mgr.delete("key1");
    expect(mgr.has("key1")).toBe(false);
  });
});

describe("LockSet", () => {
  test("isHeld returns false when lock not acquired", () => {
    const locks = new LockSet();
    expect(locks.isHeld("op1")).toBe(false);
  });

  test("tryAcquire returns true first time", () => {
    const locks = new LockSet();
    expect(locks.tryAcquire("op1")).toBe(true);
  });

  test("tryAcquire returns false if already held", () => {
    const locks = new LockSet();
    locks.tryAcquire("op1");
    expect(locks.tryAcquire("op1")).toBe(false);
  });

  test("release allows re-acquire", () => {
    const locks = new LockSet();
    locks.tryAcquire("op1");
    locks.release("op1");
    expect(locks.tryAcquire("op1")).toBe(true);
  });

  test("stale lock can be re-acquired after timeout", async () => {
    const locks = new LockSet(10); // 10ms stale timeout
    locks.tryAcquire("op1");
    await new Promise((r) => setTimeout(r, 20));
    expect(locks.tryAcquire("op1")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL on new tests**

```bash
bun test src/core/state.test.ts
```

Expected: CooldownManager tests still pass; SessionManager and LockSet tests fail.

- [ ] **Step 3: Implement SessionManager and LockSet in state.ts**

Replace `src/core/state.ts` with the full file:
```ts
// ─── CooldownManager ─────────────────────────────────────────────────────────
export class CooldownManager {
  private readonly map = new Map<string, number>();

  private key(userId: string, command: string): string {
    return `${userId}:${command}`;
  }

  set(userId: string, command: string, durationMs: number): void {
    this.map.set(this.key(userId, command), Date.now() + durationMs);
  }

  isOnCooldown(userId: string, command: string): boolean {
    const expiresAt = this.map.get(this.key(userId, command));
    if (expiresAt === undefined) return false;
    if (Date.now() >= expiresAt) {
      this.map.delete(this.key(userId, command));
      return false;
    }
    return true;
  }

  getRemainingMs(userId: string, command: string): number {
    const expiresAt = this.map.get(this.key(userId, command));
    if (expiresAt === undefined) return 0;
    return Math.max(0, expiresAt - Date.now());
  }

  clear(userId: string, command: string): void {
    this.map.delete(this.key(userId, command));
  }
}

// ─── SessionManager ───────────────────────────────────────────────────────────
/** Generic typed session store. Features create their own instances: `new SessionManager<MyType>()`. */
export class SessionManager<T> {
  private readonly map = new Map<string, T>();

  get(key: string): T | undefined { return this.map.get(key); }
  set(key: string, value: T): void { this.map.set(key, value); }
  delete(key: string): void { this.map.delete(key); }
  has(key: string): boolean { return this.map.has(key); }
}

// ─── LockSet ─────────────────────────────────────────────────────────────────
/** Exclusive operation locks with stale-timeout auto-release. */
export class LockSet {
  private readonly locks = new Map<string, number>();
  private readonly staleMs: number;

  constructor(staleMs = 5 * 60 * 1000) {
    this.staleMs = staleMs;
  }

  tryAcquire(key: string): boolean {
    const acquiredAt = this.locks.get(key);
    if (acquiredAt !== undefined && Date.now() - acquiredAt < this.staleMs) {
      return false;
    }
    this.locks.set(key, Date.now());
    return true;
  }

  release(key: string): void { this.locks.delete(key); }

  isHeld(key: string): boolean {
    const acquiredAt = this.locks.get(key);
    if (acquiredAt === undefined) return false;
    if (Date.now() - acquiredAt >= this.staleMs) {
      this.locks.delete(key);
      return false;
    }
    return true;
  }
}

// ─── Singletons ──────────────────────────────────────────────────────────────
/** Global cooldown manager. All features import from here instead of creating their own Maps. */
export const cooldowns = new CooldownManager();

/** Global lock set for exclusive operations (quest claims, fight state, etc). */
export const locks = new LockSet();
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
bun test src/core/state.test.ts
```

Expected: All 21 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/state.ts src/core/state.test.ts
git commit -m "feat: add CooldownManager, SessionManager, LockSet with singletons"
```

---

## Task 6: MongoDB connection

**Files:**
- Create: `src/core/db.ts`
- Create: `src/core/db.test.ts`

- [ ] **Step 1: Write tests**

Create `src/core/db.test.ts`:
```ts
import { describe, expect, test, beforeEach } from "bun:test";
import { disconnectDb, getDb } from "./db";

// Integration tests: only run when MONGO_URI is set
const MONGO_URI = process.env.MONGO_URI;

describe("db module", () => {
  test("getDb is a function", async () => {
    const { getDb: fn } = await import("./db");
    expect(typeof fn).toBe("function");
  });

  test("disconnectDb resets internal state so getDb reconnects", async () => {
    if (!MONGO_URI) return; // skip without real DB
    const db1 = await getDb();
    await disconnectDb();
    const db2 = await getDb();
    expect(db1).not.toBe(db2);
    await disconnectDb();
  });
});
```

- [ ] **Step 2: Implement src/core/db.ts**

Create `src/core/db.ts` (port from `tx/src/db/mongo.ts` — update env var handling):
```ts
import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

function getUri(): string {
  const uri = process.env.MONGO_URI?.trim();
  if (!uri) throw new Error("MONGO_URI environment variable is not set.");
  return uri;
}

function getDbName(): string {
  return process.env.DB_NAME ?? "txbot";
}

export async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;
  if (!client) client = new MongoClient(getUri());
  await client.connect();
  dbInstance = client.db(getDbName());
  return dbInstance;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) client = new MongoClient(getUri());
  await client.connect();
  return client;
}

export async function disconnectDb(): Promise<void> {
  if (client) await client.close();
  client = null;
  dbInstance = null;
}
```

- [ ] **Step 3: Run tests**

```bash
bun test src/core/db.test.ts
```

Expected: 1 test passes (integration test skipped if no MONGO_URI).

- [ ] **Step 4: Commit**

```bash
git add src/core/db.ts src/core/db.test.ts
git commit -m "feat: add MongoDB connection singleton"
```

---

## Task 7: DB helpers

**Files:**
- Create: `src/db/helpers.ts`
- Create: `src/db/helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/db/helpers.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import {
  deepClone,
  collectTouchedPaths,
  pruneConflictsFromSetOnInsert,
  buildSafeUpsertUpdate,
  unwrapFindOneAndUpdateResult,
} from "./helpers";

describe("deepClone", () => {
  test("returns a new object, not the same reference", () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
  });

  test("returns null as-is", () => {
    expect(deepClone(null)).toBeNull();
  });

  test("returns undefined as-is", () => {
    expect(deepClone(undefined)).toBeUndefined();
  });
});

describe("collectTouchedPaths", () => {
  test("collects paths from $set", () => {
    const paths = collectTouchedPaths({ $set: { name: "x", "a.b": 1 } });
    expect(paths.has("name")).toBe(true);
    expect(paths.has("a.b")).toBe(true);
  });

  test("excludes $setOnInsert paths", () => {
    const paths = collectTouchedPaths({ $setOnInsert: { name: "x" } });
    expect(paths.has("name")).toBe(false);
  });

  test("returns empty set for empty update", () => {
    expect(collectTouchedPaths({}).size).toBe(0);
  });
});

describe("buildSafeUpsertUpdate", () => {
  test("adds updatedAt to $set by default", () => {
    const result = buildSafeUpsertUpdate(
      { $set: { name: "test" } },
      {},
      new Date("2025-01-01"),
    );
    expect((result as any).$set.updatedAt).toEqual(new Date("2025-01-01"));
  });

  test("does not add updatedAt when setUpdatedAt is false", () => {
    const result = buildSafeUpsertUpdate(
      { $setOnInsert: { _id: "x" } },
      {},
      new Date(),
      { setUpdatedAt: false },
    );
    expect((result as any).$set?.updatedAt).toBeUndefined();
  });

  test("merges defaults into $setOnInsert", () => {
    const result = buildSafeUpsertUpdate(
      { $set: { name: "test" } },
      { defaultField: "value" },
      new Date(),
    );
    expect((result as any).$setOnInsert?.defaultField).toBe("value");
  });
});

describe("unwrapFindOneAndUpdateResult", () => {
  test("returns null for null input", () => {
    expect(unwrapFindOneAndUpdateResult(null)).toBeNull();
  });

  test("returns document directly if not wrapped", () => {
    const doc = { _id: "test", name: "x" };
    expect(unwrapFindOneAndUpdateResult(doc)).toBe(doc);
  });

  test("unwraps legacy {value} wrapper", () => {
    const doc = { _id: "test" };
    expect(unwrapFindOneAndUpdateResult({ value: doc })).toBe(doc);
  });

  test("returns null for {value: null}", () => {
    expect(unwrapFindOneAndUpdateResult({ value: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/db/helpers.test.ts
```

Expected: Error — `helpers.ts` not found.

- [ ] **Step 3: Implement src/db/helpers.ts**

Create `src/db/helpers.ts` (straight port from `tx/src/db/helpers.ts`):
```ts
import type { UpdateFilter } from "mongodb";

export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return structuredClone(value);
}

const UPDATE_OPERATORS = new Set([
  "$set", "$unset", "$inc", "$mul", "$push", "$addToSet",
  "$pull", "$pullAll", "$pop", "$min", "$max", "$currentDate",
  "$bit", "$rename", "$setOnInsert",
]);

const UPDATE_OPERATORS_EXCLUDED_FROM_TOUCH = new Set(["$setOnInsert"]);

const isOperatorUpdate = (update: Record<string, unknown>): boolean =>
  Object.keys(update).some((key) => key.startsWith("$"));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function collectTouchedPaths(update: UpdateFilter<unknown>): Set<string> {
  const touched = new Set<string>();
  if (!update || typeof update !== "object") return touched;

  const updateDoc = update as Record<string, unknown>;
  if (!isOperatorUpdate(updateDoc)) {
    for (const key of Object.keys(updateDoc)) { if (key) touched.add(key); }
    return touched;
  }

  for (const [operator, payload] of Object.entries(updateDoc)) {
    if (!operator.startsWith("$")) continue;
    if (!UPDATE_OPERATORS.has(operator)) continue;
    if (UPDATE_OPERATORS_EXCLUDED_FROM_TOUCH.has(operator)) continue;
    if (!isRecord(payload)) continue;
    if (operator === "$rename") {
      for (const [from, to] of Object.entries(payload)) {
        if (from) touched.add(from);
        if (typeof to === "string" && to) touched.add(to);
      }
      continue;
    }
    for (const key of Object.keys(payload)) { if (key) touched.add(key); }
  }
  return touched;
}

export function pruneConflictsFromSetOnInsert(
  setOnInsert: Record<string, unknown> | undefined,
  touchedPaths: Iterable<string>,
): Record<string, unknown> | undefined {
  if (!setOnInsert) return setOnInsert;
  const pruned: Record<string, unknown> = {};
  const touched = Array.from(touchedPaths ?? []);
  outer: for (const [key, value] of Object.entries(setOnInsert)) {
    if (key === "updatedAt") continue;
    for (const path of touched) {
      if (!path) continue;
      if (key === path) continue outer;
      if (key.startsWith(`${path}.`)) continue outer;
      if (path.startsWith(`${key}.`)) continue outer;
    }
    pruned[key] = value;
  }
  return pruned;
}

export function buildSafeUpsertUpdate<TSchema>(
  update: UpdateFilter<TSchema>,
  defaults: Record<string, unknown>,
  now: Date = new Date(),
  options: { setUpdatedAt?: boolean } = {},
): UpdateFilter<TSchema> {
  if (!update || typeof update !== "object") return update;
  const updateDoc = update as Record<string, unknown>;
  if (!isOperatorUpdate(updateDoc)) return update;

  const existingSet = (updateDoc.$set as Record<string, unknown> | undefined) ?? {};
  const existingSetOnInsert = (updateDoc.$setOnInsert as Record<string, unknown> | undefined) ?? {};

  const touched = collectTouchedPaths(update);
  const mergedSetOnInsert = { ...(defaults ?? {}), ...(existingSetOnInsert ?? {}) };
  const prunedSetOnInsert = pruneConflictsFromSetOnInsert(mergedSetOnInsert, touched);

  const nextSet = { ...existingSet };
  const shouldSetUpdatedAt = options.setUpdatedAt !== false;
  const hasCurrentDate =
    isRecord(updateDoc.$currentDate) &&
    Object.prototype.hasOwnProperty.call(updateDoc.$currentDate, "updatedAt");

  if (shouldSetUpdatedAt && !hasCurrentDate) nextSet.updatedAt = now;

  const nextUpdate: UpdateFilter<TSchema> = { ...update };

  if (Object.keys(nextSet).length > 0) {
    (nextUpdate as any).$set = nextSet;
  } else if ((nextUpdate as any).$set) {
    delete (nextUpdate as any).$set;
  }

  if (prunedSetOnInsert && Object.keys(prunedSetOnInsert).length > 0) {
    (nextUpdate as any).$setOnInsert = prunedSetOnInsert;
  } else if ((nextUpdate as any).$setOnInsert) {
    delete (nextUpdate as any).$setOnInsert;
  }

  return nextUpdate;
}

export function unwrapFindOneAndUpdateResult<T>(
  result: T | { value?: T | null } | null | undefined,
): T | null {
  if (!result) return null;
  if (typeof result === "object" && "value" in result) {
    return (result as { value?: T | null }).value ?? null;
  }
  return result as T;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/db/helpers.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/helpers.ts src/db/helpers.test.ts
git commit -m "feat: add DB helper utilities"
```

---

## Task 8: MongoStore

**Files:**
- Create: `src/db/store.ts`
- Create: `src/db/store.test.ts`

- [ ] **Step 1: Write tests**

Create `src/db/store.test.ts`:
```ts
import { describe, expect, test, mock } from "bun:test";
import { z } from "zod";

// We test MongoStore's parse/default behavior by using a minimal schema
// DB integration tests require MONGO_URI

const TestSchema = z.object({
  _id: z.string(),
  name: z.string().catch("default_name"),
  count: z.number().int().catch(0),
});
type TestDoc = z.infer<typeof TestSchema>;

describe("MongoStore (unit — schema behavior)", () => {
  test("schema applies defaults for missing fields", () => {
    const parsed = TestSchema.safeParse({ _id: "test" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("default_name");
      expect(parsed.data.count).toBe(0);
    }
  });

  test("schema uses catch defaults for invalid data", () => {
    const parsed = TestSchema.safeParse({ _id: "test", name: 42, count: "bad" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("default_name");
      expect(parsed.data.count).toBe(0);
    }
  });

  test("schema preserves valid data", () => {
    const parsed = TestSchema.safeParse({ _id: "x", name: "Alice", count: 5 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Alice");
      expect(parsed.data.count).toBe(5);
    }
  });
});

// Integration tests (skipped without DB)
describe("MongoStore (integration)", () => {
  if (!process.env.MONGO_URI) {
    test.skip("requires MONGO_URI", () => {});
    return;
  }

  test("get returns null for nonexistent document", async () => {
    const { MongoStore } = await import("./store");
    const store = new MongoStore("__test_store", TestSchema);
    const result = await store.get("nonexistent_id_xyz");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeNull();
  });

  test("ensure creates document with defaults", async () => {
    const { MongoStore } = await import("./store");
    const { disconnectDb } = await import("../core/db");
    const store = new MongoStore("__test_store", TestSchema);
    const id = `test_${Date.now()}`;
    const result = await store.ensure(id);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap()._id).toBe(id);
      expect(result.unwrap().name).toBe("default_name");
    }
    await store.delete(id);
    await disconnectDb();
  });
});
```

- [ ] **Step 2: Implement src/db/store.ts**

Create `src/db/store.ts` (port from `tx/src/db/mongo-store.ts` — update imports):
```ts
import type { Collection, Document, Filter, FindOptions, UpdateFilter } from "mongodb";
import type { ZodSchema } from "zod";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { buildSafeUpsertUpdate, unwrapFindOneAndUpdateResult } from "./helpers";
import { getDb } from "@/core/db";

export class MongoStore<T extends Document & { _id: string }> {
  constructor(
    private readonly collectionName: string,
    private readonly schema: ZodSchema<T>,
  ) {}

  public async collection(): Promise<Collection<T>> {
    return (await getDb()).collection<T>(this.collectionName);
  }

  private mapError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private getDefault(id: string): T {
    const raw: Record<string, unknown> = { _id: id };
    try {
      const schemaAny = this.schema as any;
      const shape = schemaAny.shape ?? schemaAny._def?.shape;
      if (shape && typeof shape === "object" && "guildId" in shape) {
        raw.guildId = id;
      }
    } catch { /* continue */ }
    const parsed = this.schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.error(`[MongoStore:${this.collectionName}] failed to build default`, { id, error: parsed.error });
    return raw as unknown as T;
  }

  private parse(doc: unknown): T {
    const parsed = this.schema.safeParse(doc);
    if (parsed.success) return parsed.data;
    const id = (doc as any)?._id ?? "unknown";
    console.error(`[MongoStore:${this.collectionName}] invalid document; using defaults`, { id, error: parsed.error });
    return this.getDefault(id);
  }

  async get(id: string): Promise<Result<T | null>> {
    try {
      const col = await this.collection();
      const doc = await col.findOne({ _id: id } as Filter<T>);
      return OkResult(doc ? this.parse(doc) : null);
    } catch (error) { return ErrResult(this.mapError(error)); }
  }

  async ensure(id: string, initial?: Partial<T>): Promise<Result<T>> {
    try {
      const col = await this.collection();
      const defaults = { ...this.getDefault(id), ...initial };
      const update = buildSafeUpsertUpdate<T>(
        { $setOnInsert: defaults as any },
        defaults as any,
        new Date(),
        { setUpdatedAt: false },
      );
      const res = await col.findOneAndUpdate(
        { _id: id } as Filter<T>,
        update as UpdateFilter<T>,
        { upsert: true, returnDocument: "after" },
      );
      const doc = unwrapFindOneAndUpdateResult<T>(res as any);
      return OkResult(this.parse(doc));
    } catch (error) { return ErrResult(this.mapError(error)); }
  }

  async patch(id: string, patch: Partial<T>): Promise<Result<T>> {
    try {
      const col = await this.collection();
      const defaults = this.getDefault(id);
      const update = buildSafeUpsertUpdate<T>({ $set: patch as any }, defaults, new Date());
      const res = await col.findOneAndUpdate(
        { _id: id } as Filter<T>,
        update as UpdateFilter<T>,
        { upsert: true, returnDocument: "after" },
      );
      const doc = unwrapFindOneAndUpdateResult<T>(res as any);
      return OkResult(this.parse(doc));
    } catch (error) { return ErrResult(this.mapError(error)); }
  }

  async set(id: string, data: T): Promise<Result<T>> {
    try {
      const col = await this.collection();
      await col.replaceOne({ _id: id } as Filter<T>, data, { upsert: true });
      return OkResult(this.parse(data));
    } catch (error) { return ErrResult(this.mapError(error)); }
  }

  async replaceIfMatch(id: string, expected: Partial<T>, next: Partial<T>): Promise<Result<T | null>> {
    try {
      const col = await this.collection();
      const res = await col.findOneAndUpdate(
        { _id: id, ...expected } as Filter<T>,
        { $set: { ...next, updatedAt: new Date() } as any },
        { returnDocument: "after" },
      );
      const doc = unwrapFindOneAndUpdateResult<T>(res as any);
      return OkResult(doc ? this.parse(doc) : null);
    } catch (error) { return ErrResult(this.mapError(error)); }
  }

  async delete(id: string): Promise<Result<boolean>> {
    try {
      const col = await this.collection();
      const res = await col.deleteOne({ _id: id } as Filter<T>);
      return OkResult((res.deletedCount ?? 0) > 0);
    } catch (error) { return ErrResult(this.mapError(error)); }
  }

  async updatePaths(
    id: string,
    paths: Record<string, unknown>,
    options: { upsert?: boolean; pipeline?: Document[] } = {},
  ): Promise<Result<void>> {
    try {
      const col = await this.collection();
      if (options.pipeline) {
        await col.updateOne({ _id: id } as Filter<T>, options.pipeline as any, { upsert: options.upsert });
      } else {
        await col.updateOne(
          { _id: id } as Filter<T>,
          { $set: { ...paths, updatedAt: new Date() } as any },
          { upsert: options.upsert },
        );
      }
      return OkResult(undefined);
    } catch (error) { return ErrResult(this.mapError(error)); }
  }

  async find(filter: Filter<T>, options?: FindOptions<T>): Promise<Result<T[]>> {
    try {
      const col = await this.collection();
      const docs = await col.find(filter, options).toArray();
      return OkResult(docs.map((doc) => this.parse(doc as any)));
    } catch (error) { return ErrResult(this.mapError(error)); }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
bun test src/db/store.test.ts
```

Expected: Unit tests pass; integration tests skipped if no MONGO_URI.

- [ ] **Step 4: Commit**

```bash
git add src/db/store.ts src/db/store.test.ts
git commit -m "feat: add MongoStore generic data layer"
```

---

## Task 9: Atomic transition (optimistic CAS)

**Files:**
- Create: `src/db/transition.ts`
- Create: `src/db/transition.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/db/transition.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { atomicTransition } from "./transition";
import { OkResult, ErrResult } from "@/core/result";

describe("atomicTransition", () => {
  test("succeeds on first attempt when commit succeeds", async () => {
    let committed = false;
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => OkResult({ value: 10 }),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u.value,
      computeNext: (snapshot) => OkResult(snapshot + 5),
      commit: async (_expected, next) => {
        committed = true;
        return OkResult({ value: next });
      },
      project: (_user, next) => next,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(15);
    expect(committed).toBe(true);
  });

  test("retries when commit returns null (CAS conflict)", async () => {
    let attempts = 0;
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => OkResult({ value: 0 }),
      getFresh: async (u) => OkResult({ value: u.value + 1 }),
      getSnapshot: (u) => u.value,
      computeNext: (snapshot) => OkResult(snapshot + 10),
      commit: async (_expected, _next) => {
        attempts++;
        if (attempts < 3) return OkResult(null); // simulate CAS miss
        return OkResult({ value: _next });
      },
      project: (_user, next) => next,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isOk()).toBe(true);
    expect(attempts).toBe(3);
  });

  test("calls onExhausted when all attempts fail", async () => {
    const result = await atomicTransition({
      attempts: 2,
      getInitial: async () => OkResult({ value: 0 }),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u.value,
      computeNext: (snapshot) => OkResult(snapshot),
      commit: async () => OkResult(null), // always fails
      project: (_u, next) => next,
      onExhausted: () => ErrResult(new Error("gave up")),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("gave up");
  });

  test("propagates error from getInitial", async () => {
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => ErrResult(new Error("db down")),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u,
      computeNext: (s) => OkResult(s),
      commit: async () => OkResult(null),
      project: (u) => u,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("db down");
  });

  test("propagates error from computeNext", async () => {
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => OkResult({ value: 0 }),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u.value,
      computeNext: () => ErrResult(new Error("compute failed")),
      commit: async () => OkResult(null),
      project: (_u, next) => next,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("compute failed");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/db/transition.test.ts
```

Expected: Error — `transition.ts` not found.

- [ ] **Step 3: Implement src/db/transition.ts**

Create `src/db/transition.ts` (port from `tx/src/db/atomic-transition.ts` — update imports):
```ts
import { ErrResult, OkResult, type Result } from "@/core/result";

export type AtomicTransitionParams<TUser, TSnapshot, TNext, TOut> = {
  attempts: number;
  getInitial: () => Promise<Result<TUser, Error>>;
  getFresh: (previousUser: TUser, previousSnapshot: TSnapshot) => Promise<Result<TUser, Error>>;
  getSnapshot: (user: TUser) => TSnapshot;
  computeNext: (snapshot: TSnapshot) => Promise<Result<TNext, Error>> | Result<TNext, Error>;
  commit: (expected: TSnapshot, next: TNext) => Promise<Result<TUser | null, Error>>;
  project: (updatedUser: TUser, next: TNext, expected: TSnapshot) => TOut;
  onExhausted: (lastUser: TUser, lastSnapshot: TSnapshot) => Result<TOut, Error>;
};

export async function atomicTransition<TUser, TSnapshot, TNext, TOut>(
  params: AtomicTransitionParams<TUser, TSnapshot, TNext, TOut>,
): Promise<Result<TOut, Error>> {
  const initial = await params.getInitial();
  if (initial.isErr()) return ErrResult(initial.error);

  let user = initial.unwrap();
  let snapshot = params.getSnapshot(user);

  for (let attempt = 0; attempt < params.attempts; attempt += 1) {
    const nextRes = await params.computeNext(snapshot);
    if (nextRes.isErr()) return ErrResult(nextRes.error);
    const next = nextRes.unwrap();

    const committed = await params.commit(snapshot, next);
    if (committed.isErr()) return ErrResult(committed.error);

    const updatedUser = committed.unwrap();
    if (updatedUser) {
      return OkResult(params.project(updatedUser, next, snapshot));
    }

    const fresh = await params.getFresh(user, snapshot);
    if (fresh.isErr()) return ErrResult(fresh.error);

    user = fresh.unwrap();
    snapshot = params.getSnapshot(user);
  }

  return params.onExhausted(user, snapshot);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/db/transition.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/transition.ts src/db/transition.test.ts
git commit -m "feat: add atomicTransition optimistic CAS"
```

---

## Task 10: Schemas

**Files:**
- Create: `src/db/schemas/rpg-profile.ts`
- Create: `src/db/schemas/user.ts`
- Create: `src/db/schemas/guild.ts`
- Create: `src/db/schemas/schemas.test.ts`

- [ ] **Step 1: Write schema tests**

Create `src/db/schemas/schemas.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { UserSchema } from "./user";
import { GuildSchema } from "./guild";
import { RpgProfileSchema } from "./rpg-profile";

describe("UserSchema", () => {
  test("parses minimal doc with _id", () => {
    const result = UserSchema.safeParse({ _id: "user123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._id).toBe("user123");
      expect(result.data.warns).toEqual([]);
      expect(result.data.currency).toEqual({});
    }
  });

  test("applies catch defaults for invalid warns", () => {
    const result = UserSchema.safeParse({ _id: "x", warns: "bad" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.warns).toEqual([]);
  });
});

describe("GuildSchema", () => {
  test("parses minimal doc with _id", () => {
    const result = GuildSchema.safeParse({ _id: "guild123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._id).toBe("guild123");
      expect(result.data.features).toBeDefined();
    }
  });
});

describe("RpgProfileSchema", () => {
  test("parses empty object with defaults", () => {
    const result = RpgProfileSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hpCurrent).toBe(100);
      expect(result.data.wins).toBe(0);
      expect(result.data.isFighting).toBe(false);
    }
  });

  test("preserves valid data", () => {
    const result = RpgProfileSchema.safeParse({ hpCurrent: 75, wins: 3, losses: 1, isFighting: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hpCurrent).toBe(75);
      expect(result.data.wins).toBe(3);
    }
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/db/schemas/schemas.test.ts
```

Expected: Error — schema files not found.

- [ ] **Step 3: Create src/db/schemas/rpg-profile.ts**

Create `src/db/schemas/rpg-profile.ts` (straight port from `tx/src/db/schemas/rpg-profile.ts`):
```ts
import { z } from "zod";

export const EquipmentSlotSchema = z.enum([
  "weapon", "shield", "helmet", "chest", "pants", "boots", "ring", "necklace",
]);
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>;

export const EquippedItemSchema = z.object({
  instanceId: z.string(),
  itemId: z.string(),
  durability: z.number(),
});
export type EquippedItem = z.infer<typeof EquippedItemSchema>;

export const LoadoutSchema = z.object({
  weapon: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  shield: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  helmet: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  chest: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  pants: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  boots: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  ring: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  necklace: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
});
export type Loadout = z.infer<typeof LoadoutSchema>;

export function defaultLoadout(): Loadout {
  return { weapon: null, shield: null, helmet: null, chest: null, pants: null, boots: null, ring: null, necklace: null };
}

const DateSchema = z.coerce.date().catch(() => new Date());

export const StarterKitTypeSchema = z.enum(["miner", "lumber"]);
export type StarterKitType = z.infer<typeof StarterKitTypeSchema>;

export const RpgProfileSchema = z.object({
  loadout: LoadoutSchema.catch(defaultLoadout),
  hpCurrent: z.number().int().min(0).catch(100),
  wins: z.number().int().min(0).catch(0),
  losses: z.number().int().min(0).catch(0),
  isFighting: z.boolean().catch(false),
  activeFightId: z.string().nullable().catch(null),
  starterKitType: StarterKitTypeSchema.nullable().catch(null),
  starterKitClaimedAt: z.coerce.date().nullable().catch(null),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  version: z.number().int().nonnegative().catch(0),
});
export type RpgProfileData = z.infer<typeof RpgProfileSchema>;
export type RpgProfilePatch = Partial<RpgProfileData>;
```

- [ ] **Step 4: Create src/db/schemas/user.ts**

Create `src/db/schemas/user.ts` (simplified port — currency/inventory loose-typed; will be tightened in Economy plan):
```ts
import { z } from "zod";
import { RpgProfileSchema, type RpgProfileData } from "./rpg-profile";

export const WarnSchema = z.object({
  reason: z.string().catch(""),
  warn_id: z.string(),
  moderator: z.string(),
  timestamp: z.string(),
});
export type Warn = z.infer<typeof WarnSchema>;

export const SanctionType = z.enum(["BAN", "KICK", "TIMEOUT", "WARN", "RESTRICT"]);
export type SanctionType = z.infer<typeof SanctionType>;

export const SanctionHistoryEntrySchema = z.object({
  type: SanctionType,
  description: z.string(),
  date: z.string().optional().catch(() => new Date().toISOString()),
});
export type SanctionHistoryEntry = z.infer<typeof SanctionHistoryEntrySchema>;

export const UserSchema = z.object({
  _id: z.string(),
  warns: z.array(WarnSchema).catch(() => []),
  sanction_history: z.record(z.string(), z.array(SanctionHistoryEntrySchema)).catch(() => ({})),
  openTickets: z.array(z.string()).catch(() => []),
  // Loose-typed until Economy plan defines the currency schema
  currency: z.record(z.string(), z.unknown()).catch(() => ({})),
  inventory: z.record(z.string(), z.unknown()).catch(() => ({})),
  // Economy account data — typed as loose record until Economy plan
  economyAccount: z.record(z.string(), z.unknown()).optional().catch(() => undefined),
  // RPG profile — embedded subdocument
  rpgProfile: RpgProfileSchema.optional().catch(() => undefined) as z.ZodType<RpgProfileData | undefined>,
  minigames: z.record(z.string(), z.unknown()).optional().catch(() => ({})),
  votingStats: z.record(z.string(), z.unknown()).optional().catch(() => ({})),
  voteAggregates: z.record(z.string(), z.unknown()).optional().catch(() => ({})),
  votingPrefs: z.object({
    optOut: z.boolean().optional(),
    showVotes: z.boolean().optional(),
    updatedAt: z.date().optional(),
  }).optional().catch(() => ({})),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type User = z.infer<typeof UserSchema>;
```

- [ ] **Step 5: Create src/db/schemas/guild.ts**

Create `src/db/schemas/guild.ts` (port — inline AI constants, no external imports):
```ts
import { z } from "zod";

// AI defaults (inlined — no external service import needed at schema level)
const DEFAULT_PROVIDER_ID = "gemini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const EconomySectorEnum = z.union([
  z.literal("global"), z.literal("works"), z.literal("trade"), z.literal("tax"),
]);

export const DailyConfigSchema = z.object({
  dailyReward: z.number().int().catch(250),
  dailyCooldownHours: z.number().int().catch(24),
  dailyCurrencyId: z.string().catch("coins"),
  dailyFeeRate: z.number().min(0).max(0.2).catch(0.0),
  dailyFeeSector: EconomySectorEnum.catch(() => "tax" as const),
  dailyStreakBonus: z.number().int().min(0).catch(5),
  dailyStreakCap: z.number().int().min(0).catch(10),
});

export const WorkConfigSchema = z.object({
  workRewardBase: z.number().int().catch(120),
  workBaseMintReward: z.number().int().min(0).catch(100),
  workBonusFromWorksMax: z.number().int().min(0).catch(100),
  workBonusScaleMode: z.enum(["flat", "percent"]).catch("flat"),
  workCooldownMinutes: z.number().int().catch(30),
  workDailyCap: z.number().int().catch(5),
  workCurrencyId: z.string().catch("coins"),
  workPaysFromSector: EconomySectorEnum.catch(() => "works" as const),
  workFailureChance: z.number().min(0).max(1).catch(0.1),
});

export enum Features {
  Tickets = "tickets",
  Automod = "automod",
  Autoroles = "autoroles",
  Warns = "warns",
  Roles = "roles",
  Reputation = "reputation",
  ReputationDetection = "reputationDetection",
  Tops = "tops",
  Suggest = "suggest",
  Economy = "economy",
  Game = "game",
}

export const DEFAULT_GUILD_FEATURES: Readonly<Record<Features, boolean>> = Object.freeze(
  Object.values(Features).reduce(
    (acc, key) => ({ ...acc, [key]: true }),
    {} as Record<Features, boolean>,
  ),
);

export const GuildFeaturesSchema = z.record(z.string(), z.boolean()).catch(() => DEFAULT_GUILD_FEATURES);

export const CoreChannelSchema = z.object({ channelId: z.string() });
export const ManagedChannelSchema = z.object({ id: z.string(), label: z.string(), channelId: z.string() });

export const GuildChannelsSchema = z.object({
  core: z.record(z.string(), CoreChannelSchema.nullable()).catch(() => ({
    welcome: null, goodbye: null, logs: null, reports: null, suggestions: null, tickets: null,
  })),
  managed: z.record(z.string(), ManagedChannelSchema).catch(() => ({})),
  ticketMessageId: z.string().nullable().catch(null),
  ticketHelperRoles: z.array(z.string()).catch(() => []),
  ticketCategoryId: z.string().nullable().catch(null),
});

export const ForumAutoReplySchema = z.object({ forumIds: z.array(z.string()).catch(() => []) });
export const AiConfigSchema = z.object({
  provider: z.string().catch(DEFAULT_PROVIDER_ID),
  model: z.string().catch(DEFAULT_GEMINI_MODEL),
});

export const AutomodSchema = z.object({
  linkSpam: z.object({
    enabled: z.boolean().catch(false),
    maxLinks: z.number().int().catch(4),
    windowSeconds: z.number().int().catch(10),
    timeoutSeconds: z.number().int().catch(300),
    action: z.enum(["timeout", "mute", "delete", "report"]).catch("timeout"),
    reportChannelId: z.string().nullable().catch(null),
  }).catch(() => ({ enabled: false, maxLinks: 4, windowSeconds: 10, timeoutSeconds: 300, action: "timeout" as const, reportChannelId: null })),
  domainWhitelist: z.object({
    enabled: z.boolean().catch(false),
    domains: z.array(z.string()).catch(() => []),
  }).catch(() => ({ enabled: false, domains: [] })),
  shorteners: z.object({
    enabled: z.boolean().catch(false),
    resolveFinalUrl: z.boolean().catch(false),
    allowedShorteners: z.array(z.string()).catch(() => ["bit.ly", "t.co", "tinyurl.com", "cutt.ly", "is.gd", "rebrand.ly", "goo.gl"]),
  }).catch(() => ({ enabled: false, resolveFinalUrl: false, allowedShorteners: ["bit.ly", "t.co", "tinyurl.com", "cutt.ly", "is.gd", "rebrand.ly", "goo.gl"] })),
}).catch(() => ({
  linkSpam: { enabled: false, maxLinks: 4, windowSeconds: 10, timeoutSeconds: 300, action: "timeout" as const, reportChannelId: null },
  domainWhitelist: { enabled: false, domains: [] },
  shorteners: { enabled: false, resolveFinalUrl: false, allowedShorteners: ["bit.ly", "t.co", "tinyurl.com"] },
}));

export const GuildSchema = z.object({
  _id: z.string(),
  roles: z.record(z.string(), z.any()).catch(() => ({})),
  channels: GuildChannelsSchema.catch(() => ({
    core: { welcome: null, goodbye: null, logs: null, reports: null, suggestions: null, tickets: null },
    managed: {},
    ticketMessageId: null,
    ticketHelperRoles: [],
    ticketCategoryId: null,
  })),
  pendingTickets: z.array(z.string()).catch(() => []),
  features: GuildFeaturesSchema,
  forumAutoReply: ForumAutoReplySchema.catch(() => ({ forumIds: [] })),
  ai: AiConfigSchema.catch(() => ({ provider: DEFAULT_PROVIDER_ID, model: DEFAULT_GEMINI_MODEL })),
  reputation: z.object({ keywords: z.array(z.string()).catch(() => []) }).catch(() => ({ keywords: [] })),
  automod: AutomodSchema,
  economy: z.object({
    daily: DailyConfigSchema.catch(() => ({ dailyReward: 250, dailyCooldownHours: 24, dailyCurrencyId: "coins", dailyFeeRate: 0, dailyFeeSector: "tax" as const, dailyStreakBonus: 5, dailyStreakCap: 10 })),
    work: WorkConfigSchema.catch(() => ({ workRewardBase: 120, workBaseMintReward: 100, workBonusFromWorksMax: 100, workBonusScaleMode: "flat" as const, workCooldownMinutes: 30, workDailyCap: 5, workCurrencyId: "coins", workPaysFromSector: "works" as const, workFailureChance: 0.1 })),
    sectors: z.object({ global: z.number().catch(0), works: z.number().catch(0), trade: z.number().catch(0), tax: z.number().catch(0) }).optional().catch(() => ({ global: 0, works: 0, trade: 0, tax: 0 })),
  }).catch(() => ({
    daily: { dailyReward: 250, dailyCooldownHours: 24, dailyCurrencyId: "coins", dailyFeeRate: 0, dailyFeeSector: "tax" as const, dailyStreakBonus: 5, dailyStreakCap: 10 },
    work: { workRewardBase: 120, workBaseMintReward: 100, workBonusFromWorksMax: 100, workBonusScaleMode: "flat" as const, workCooldownMinutes: 30, workDailyCap: 5, workCurrencyId: "coins", workPaysFromSector: "works" as const, workFailureChance: 0.1 },
  })),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Guild = z.infer<typeof GuildSchema>;
export type GuildChannelsRecord = z.infer<typeof GuildChannelsSchema>;
export type GuildFeaturesRecord = z.infer<typeof GuildFeaturesSchema>;
export type AiConfigRecord = z.infer<typeof AiConfigSchema>;
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
bun test src/db/schemas/schemas.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/db/schemas/
git commit -m "feat: add Zod schemas for User, Guild, RpgProfile"
```

---

## Task 11: Repositories

**Files:**
- Create: `src/db/repositories/users.ts`
- Create: `src/db/repositories/guilds.ts`
- Create: `src/db/repositories/rpg.ts`
- Create: `src/db/repositories/repositories.test.ts`

- [ ] **Step 1: Write tests**

Create `src/db/repositories/repositories.test.ts`:
```ts
import { describe, expect, test } from "bun:test";

describe("repositories (unit — exports)", () => {
  test("users repo exports expected functions", async () => {
    const repo = await import("./users");
    expect(typeof repo.getUser).toBe("function");
    expect(typeof repo.ensureUser).toBe("function");
    expect(typeof repo.patchUser).toBe("function");
    expect(typeof repo.replaceUserIfMatch).toBe("function");
    expect(typeof repo.updateUserPaths).toBe("function");
    expect(typeof repo.userStore).toBe("object");
  });

  test("guilds repo exports expected functions", async () => {
    const repo = await import("./guilds");
    expect(typeof repo.getGuild).toBe("function");
    expect(typeof repo.ensureGuild).toBe("function");
    expect(typeof repo.patchGuild).toBe("function");
    expect(typeof repo.guildStore).toBe("object");
  });

  test("rpg repo exports expected functions", async () => {
    const repo = await import("./rpg");
    expect(typeof repo.getRpgProfile).toBe("function");
    expect(typeof repo.ensureRpgProfile).toBe("function");
    expect(typeof repo.patchRpgProfile).toBe("function");
    // rpgStore is re-exported from userStore
    expect(repo.rpgStore).toBeDefined();
  });
});
```

- [ ] **Step 2: Create src/db/repositories/users.ts**

Create `src/db/repositories/users.ts`:
```ts
import { MongoStore } from "@/db/store";
import { UserSchema, type User } from "@/db/schemas/user";
import type { Result } from "@/core/result";

export const userStore = new MongoStore("users", UserSchema);

export async function getUser(userId: string): Promise<Result<User | null>> {
  return userStore.get(userId);
}

export async function ensureUser(userId: string): Promise<Result<User>> {
  return userStore.ensure(userId);
}

export async function patchUser(userId: string, patch: Partial<User>): Promise<Result<User>> {
  return userStore.patch(userId, patch);
}

export async function replaceUserIfMatch(
  userId: string,
  expected: Partial<User>,
  next: Partial<User>,
): Promise<Result<User | null>> {
  return userStore.replaceIfMatch(userId, expected, next);
}

export async function updateUserPaths(
  userId: string,
  paths: Record<string, unknown>,
  options?: { upsert?: boolean },
): Promise<Result<void>> {
  return userStore.updatePaths(userId, paths, options);
}
```

- [ ] **Step 3: Create src/db/repositories/guilds.ts**

Create `src/db/repositories/guilds.ts`:
```ts
import { MongoStore } from "@/db/store";
import { GuildSchema, type Guild } from "@/db/schemas/guild";
import type { Result } from "@/core/result";

export const guildStore = new MongoStore("guilds", GuildSchema);

export async function getGuild(guildId: string): Promise<Result<Guild | null>> {
  return guildStore.get(guildId);
}

export async function ensureGuild(guildId: string): Promise<Result<Guild>> {
  return guildStore.ensure(guildId);
}

export async function patchGuild(guildId: string, patch: Partial<Guild>): Promise<Result<Guild>> {
  return guildStore.patch(guildId, patch);
}

export async function updateGuildPaths(
  guildId: string,
  paths: Record<string, unknown>,
  options?: { upsert?: boolean },
): Promise<Result<void>> {
  return guildStore.updatePaths(guildId, paths, options);
}
```

- [ ] **Step 4: Create src/db/repositories/rpg.ts**

RPG profile is embedded inside the user document (field: `rpgProfile`). This repository reads/writes it via userStore using dot-notation paths — no separate collection required, existing data stays compatible.

Create `src/db/repositories/rpg.ts`:
```ts
import { ErrResult, OkResult, type Result } from "@/core/result";
import { RpgProfileSchema, type RpgProfileData } from "@/db/schemas/rpg-profile";
import { userStore } from "./users";

export { userStore as rpgStore };

export async function getRpgProfile(userId: string): Promise<Result<RpgProfileData | null>> {
  const res = await userStore.get(userId);
  if (res.isErr()) return ErrResult(res.error);
  return OkResult(res.unwrap()?.rpgProfile ?? null);
}

export async function ensureRpgProfile(userId: string): Promise<Result<RpgProfileData>> {
  const res = await userStore.ensure(userId);
  if (res.isErr()) return ErrResult(res.error);
  const user = res.unwrap();
  if (user.rpgProfile) return OkResult(user.rpgProfile);
  const defaultProfile = RpgProfileSchema.parse({});
  const patch = await userStore.updatePaths(userId, { rpgProfile: defaultProfile });
  if (patch.isErr()) return ErrResult(patch.error);
  return OkResult(defaultProfile);
}

/** Patches rpgProfile sub-fields using MongoDB dot-notation paths. */
export async function patchRpgProfile(
  userId: string,
  patch: Partial<RpgProfileData>,
): Promise<Result<RpgProfileData>> {
  const paths: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    paths[`rpgProfile.${key}`] = value;
  }
  const res = await userStore.patch(userId, paths as any);
  if (res.isErr()) return ErrResult(res.error);
  const user = res.unwrap();
  if (!user.rpgProfile) return ErrResult(new Error("rpgProfile not found after patch"));
  return OkResult(user.rpgProfile);
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
bun test src/db/repositories/repositories.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories/
git commit -m "feat: add user, guild, RPG repositories"
```

---

## Task 12: Shared utilities

**Files:**
- Create: `src/utils/ids.ts`
- Create: `src/utils/time.ts`
- Create: `src/utils/currency.ts`
- Create: `src/utils/utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/utils.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { buildCorrelationId, buildCompositeId, buildProgressId, buildAchievementId } from "./ids";
import { msToHuman, getCooldownExpiry, isCooldownExpired, minutesToMs, hoursToMs } from "./time";
import { formatAmount, applyTaxRate, clamp, formatCurrencyAmount } from "./currency";

describe("ids", () => {
  test("buildCorrelationId returns a non-empty string", () => {
    expect(typeof buildCorrelationId()).toBe("string");
    expect(buildCorrelationId().length).toBeGreaterThan(0);
  });

  test("two buildCorrelationId calls produce different values", () => {
    expect(buildCorrelationId()).not.toBe(buildCorrelationId());
  });

  test("buildCompositeId joins parts with colon", () => {
    expect(buildCompositeId("a", "b", "c")).toBe("a:b:c");
  });

  test("buildProgressId returns userId:questId", () => {
    expect(buildProgressId("u1", "q1")).toBe("u1:q1");
  });

  test("buildAchievementId returns userId:achievementId", () => {
    expect(buildAchievementId("u1", "ach1")).toBe("u1:ach1");
  });
});

describe("time", () => {
  test("msToHuman formats seconds", () => {
    expect(msToHuman(30_000)).toBe("30s");
  });

  test("msToHuman formats minutes", () => {
    expect(msToHuman(90_000)).toBe("1m");
  });

  test("msToHuman formats hours", () => {
    expect(msToHuman(3_600_000)).toBe("1h");
  });

  test("msToHuman formats hours and minutes", () => {
    expect(msToHuman(5_400_000)).toBe("1h 30m");
  });

  test("msToHuman formats days", () => {
    expect(msToHuman(86_400_000)).toBe("1d");
  });

  test("getCooldownExpiry returns a future timestamp", () => {
    const expiry = getCooldownExpiry(60_000);
    expect(expiry).toBeGreaterThan(Date.now());
  });

  test("isCooldownExpired returns false for future expiry", () => {
    expect(isCooldownExpired(Date.now() + 60_000)).toBe(false);
  });

  test("isCooldownExpired returns true for past expiry", () => {
    expect(isCooldownExpired(Date.now() - 1)).toBe(true);
  });

  test("minutesToMs converts correctly", () => {
    expect(minutesToMs(1)).toBe(60_000);
    expect(minutesToMs(30)).toBe(1_800_000);
  });

  test("hoursToMs converts correctly", () => {
    expect(hoursToMs(1)).toBe(3_600_000);
    expect(hoursToMs(24)).toBe(86_400_000);
  });
});

describe("currency", () => {
  test("formatAmount returns localized string", () => {
    expect(formatAmount(1000)).toBe("1,000");
  });

  test("formatAmount includes symbol", () => {
    expect(formatAmount(500, "💰")).toBe("💰 500");
  });

  test("applyTaxRate computes net and fee", () => {
    const { net, fee } = applyTaxRate(1000, 0.1);
    expect(fee).toBe(100);
    expect(net).toBe(900);
  });

  test("applyTaxRate floors the fee", () => {
    const { fee } = applyTaxRate(100, 0.15);
    expect(fee).toBe(15);
    expect(Number.isInteger(fee)).toBe(true);
  });

  test("clamp respects min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  test("clamp respects max", () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });

  test("clamp passes through valid values", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  test("formatCurrencyAmount uses symbol when provided", () => {
    const result = formatCurrencyAmount(500, "coins", { coins: "🪙" });
    expect(result).toContain("🪙");
    expect(result).toContain("500");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/utils/utils.test.ts
```

Expected: Error — utility files not found.

- [ ] **Step 3: Create src/utils/ids.ts**

Create `src/utils/ids.ts`:
```ts
/** Generates a unique correlation ID (timestamp + random suffix). */
export function buildCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Joins parts with `:` to form a composite document ID. */
export function buildCompositeId(...parts: string[]): string {
  return parts.join(":");
}

/** Quest progress document ID: `userId:questId` */
export function buildProgressId(userId: string, questId: string): string {
  return buildCompositeId(userId, questId);
}

/** Achievement document ID: `userId:achievementId` */
export function buildAchievementId(userId: string, achievementId: string): string {
  return buildCompositeId(userId, achievementId);
}

/** Market listing ID: `listing:<correlationId>` */
export function buildListingId(): string {
  return `listing:${buildCorrelationId()}`;
}
```

- [ ] **Step 4: Create src/utils/time.ts**

Create `src/utils/time.ts`:
```ts
/** Formats a millisecond duration as human-readable string (e.g. "1h 30m"). */
export function msToHuman(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

/** Returns the timestamp (ms) when a cooldown of `durationMs` expires from now. */
export function getCooldownExpiry(durationMs: number): number {
  return Date.now() + durationMs;
}

/** Returns true if the given expiry timestamp has passed. */
export function isCooldownExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

export function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

export function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}
```

- [ ] **Step 5: Create src/utils/currency.ts**

Create `src/utils/currency.ts`:
```ts
/** Formats a number with locale-aware thousands separators, with optional prefix symbol. */
export function formatAmount(amount: number, symbol?: string): string {
  const formatted = amount.toLocaleString("en-US");
  return symbol ? `${symbol} ${formatted}` : formatted;
}

/** Formats a currency amount using a symbol lookup map. Falls back to currencyId as label. */
export function formatCurrencyAmount(
  amount: number,
  currencyId: string,
  symbols: Record<string, string> = {},
): string {
  const symbol = symbols[currencyId] ?? currencyId;
  return `${formatAmount(amount)} ${symbol}`;
}

/** Clamps a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Applies a tax rate to an amount, returning both the net and the floored fee. */
export function applyTaxRate(amount: number, taxRate: number): { net: number; fee: number } {
  const fee = Math.floor(amount * taxRate);
  return { net: amount - fee, fee };
}

/** Returns true if the amount is a valid positive integer. */
export function isValidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
bun test src/utils/utils.test.ts
```

Expected: All 22 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/ids.ts src/utils/time.ts src/utils/currency.ts src/utils/utils.test.ts
git commit -m "feat: add shared utilities (ids, time, currency)"
```

---

## Task 13: Embed utilities

**Files:**
- Create: `src/utils/embeds.ts`

These utilities depend on Discord.js types and are validated by the type-check in Task 14, not by unit tests (embed rendering requires a live client).

- [ ] **Step 1: Create src/utils/embeds.ts**

Create `src/utils/embeds.ts`:
```ts
import { EmbedBuilder, type ColorResolvable } from "discord.js";

export const Colors = {
  success: 0x57f287 as ColorResolvable,
  error: 0xed4245 as ColorResolvable,
  warning: 0xfee75c as ColorResolvable,
  info: 0x5865f2 as ColorResolvable,
  neutral: 0x2b2d31 as ColorResolvable,
} as const;

export function successEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.success).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function errorEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.error).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function infoEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.info).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function warningEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.warning).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function neutralEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.neutral).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/embeds.ts
git commit -m "feat: add Discord embed builder utilities"
```

---

## Task 14: Discord.js client + bootstrap

**Files:**
- Create: `src/core/client.ts`
- Modify: `src/index.ts` (replace stub with real bootstrap)

- [ ] **Step 1: Create src/core/client.ts**

Create `src/core/client.ts`:
```ts
import { Client, GatewayIntentBits, Partials } from "discord.js";

const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildVoiceStates,
];

const PARTIALS = [
  Partials.Message,
  Partials.Channel,
  Partials.Reaction,
  Partials.GuildMember,
];

export function createClient(): Client {
  return new Client({ intents: INTENTS, partials: PARTIALS });
}
```

- [ ] **Step 2: Replace src/index.ts with real bootstrap**

Replace `src/index.ts`:
```ts
import "dotenv/config";
import { createClient } from "@/core/client";
import { getDb, disconnectDb } from "@/core/db";
import { createLogger } from "@/core/logger";

const log = createLogger("bootstrap");

async function bootstrap(): Promise<void> {
  log.info("Starting tx-v2...");

  await getDb();
  log.info("MongoDB connected.");

  const client = createClient();

  // Feature event handlers registered here (added by subsequent feature plans)

  client.once("ready", (c) => {
    log.info(`Logged in as ${c.user.tag}`);
  });

  process.on("SIGINT", async () => {
    log.info("Shutting down...");
    await client.destroy();
    await disconnectDb();
    process.exit(0);
  });

  const token = process.env.TOKEN;
  if (!token) throw new Error("TOKEN environment variable is not set.");
  await client.login(token);
}

bootstrap().catch((err) => {
  console.error("[bootstrap] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Run type check**

```bash
cd C:/Users/Hyvnt/T/Discord/tx-v2
bun build --target=bun src/index.ts 2>&1 | head -30
```

Expected: Compiles without TypeScript errors. (May show warnings about missing .env — that's expected without a real token.)

- [ ] **Step 4: Commit**

```bash
git add src/core/client.ts src/index.ts
git commit -m "feat: add Discord.js client factory and bootstrap"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd C:/Users/Hyvnt/T/Discord/tx-v2
bun test
```

Expected output:
```
✓ src/core/result.test.ts   (16 tests)
✓ src/core/logger.test.ts   (4 tests)
✓ src/core/state.test.ts    (21 tests)
✓ src/core/db.test.ts       (1 test)
✓ src/db/helpers.test.ts    (8+ tests)
✓ src/db/store.test.ts      (3+ unit tests)
✓ src/db/transition.test.ts (5 tests)
✓ src/db/schemas/schemas.test.ts (5 tests)
✓ src/db/repositories/repositories.test.ts (3 tests)
✓ src/utils/utils.test.ts   (22 tests)
```

All tests should pass. Integration tests will be skipped if `MONGO_URI` is not set.

- [ ] **Step 2: Verify no stray runtime state outside core/state.ts**

```bash
grep -r "new Map" src/ --include="*.ts" | grep -v "state.ts" | grep -v ".test.ts"
```

Expected: No output. All Maps live in `src/core/state.ts`.

- [ ] **Step 3: Check no file exceeds 400 lines**

```bash
find src -name "*.ts" -not -name "*.test.ts" | xargs wc -l | sort -rn | head -10
```

Expected: No file exceeds 400 lines.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: foundation complete — all tests passing"
```

---

## Summary

**What this plan delivers:**
- New `tx-v2/` project scaffold with Bun + Discord.js + MongoDB + Zod + TypeScript strict + Biome
- `src/core/result.ts` — Result<T,E> type (port)
- `src/core/logger.ts` — createLogger factory
- `src/core/state.ts` — CooldownManager, SessionManager, LockSet + singletons
- `src/core/db.ts` — MongoDB connection (port)
- `src/core/client.ts` — Discord.js Client factory
- `src/db/helpers.ts` — buildSafeUpsertUpdate etc (port)
- `src/db/store.ts` — MongoStore<T> (port)
- `src/db/transition.ts` — atomicTransition CAS (port)
- `src/db/schemas/` — User, Guild, RpgProfile Zod schemas (port + simplify)
- `src/db/repositories/` — users, guilds, rpg wrappers
- `src/utils/ids.ts`, `time.ts`, `currency.ts`, `embeds.ts`

**Next plans:** Economy feature → RPG feature → Moderation → Remaining features → Integration

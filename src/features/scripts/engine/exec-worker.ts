/**
 * Worker entry for the collect-then-apply engine.
 *
 * Receives already-transpiled JS (a function body) plus a serializable snapshot
 * and capability set. Reconstructs `ctx`, runs the body, and posts back the
 * return value plus the recorded operation plan. It never touches discord.js —
 * mutations are *recorded*, not performed. The parent owns the timeout
 * kill-switch and validates everything that comes back.
 */
import { buildContext, type WorkerRequest, type WorkerResponse } from "./api";
import type { Operation } from "./operations";

// `new AsyncFunction(...)` so a script body may use `await` and we can uniformly
// await the result. Sync bodies work unchanged.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (ctx: unknown) => Promise<unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { code, snapshot, capabilities, maxOperations } = event.data;
  const operations: Operation[] = [];

  try {
    const ctx = buildContext(snapshot, new Set(capabilities), (op) => {
      if (operations.length >= maxOperations) {
        throw new Error(`Operation budget exceeded (max ${maxOperations})`);
      }
      operations.push(op);
    });

    const body = new AsyncFunction("ctx", `"use strict";\n${code}`);
    const value = await body(ctx);

    // postMessage needs a structured-cloneable value; strip functions/undefined.
    let safeValue: unknown;
    try {
      safeValue = value === undefined ? null : JSON.parse(JSON.stringify(value));
    } catch {
      throw new Error("Script return value is not serializable");
    }

    self.postMessage({ ok: true, value: safeValue, operations } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({ ok: false, message: errorMessage(error) } satisfies WorkerResponse);
  }
};

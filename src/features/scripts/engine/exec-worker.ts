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
import { input } from "./input";
import type { Operation } from "./operations";
import { color, display, field, footer, sep, title } from "./output";

// `new AsyncFunction(...)` so a script body may use `await` and we can uniformly
// await the result. Sync bodies work unchanged.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (ctx: unknown, _out: unknown, _inp: unknown) => Promise<unknown>;

// Output helpers are injected as bare names via a preamble destructure so stored
// scripts can write `title("...")` without any explicit import.
const OUTPUT_HELPERS = { title, color, sep, footer, display, field };
// WHY `display` not `text`: the ui/v2 layer exports a `text` helper used at call
// sites in the bot; giving this one the same name would shadow it confusingly for
// library-script authors who might import both. `display(...)` is unambiguous.

// `input` is a no-op at runtime — declarations were already collected by scanInputs
// on the main thread. Injected so `input.text(...)` calls don't throw.
const INPUT_HELPERS = { input };
const PREAMBLE = `const { title, color, sep, footer, display, field } = _out;\nconst { input } = _inp;`;

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

    const body = new AsyncFunction("ctx", "_out", "_inp", `"use strict";\n${PREAMBLE}\n${code}`);
    const value = await body(ctx, OUTPUT_HELPERS, INPUT_HELPERS);

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

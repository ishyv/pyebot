import type { ScriptContext } from "./sandbox";

type WorkerRequest = {
  readonly script: string;
  readonly ctx: ScriptContext;
};

type WorkerResponse =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { script, ctx } = event.data;
    // WHY: admin scripts are still JavaScript function expressions. The worker
    // does not make them untrusted-safe; it only gives the parent a process-safe
    // kill switch for CPU-bound loops.
    const result = new Function("ctx", `"use strict"; return (${script})(ctx);`)(ctx);
    const value = await Promise.resolve(result);
    self.postMessage({ ok: true, value } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({ ok: false, message: errorMessage(error) } satisfies WorkerResponse);
  }
};

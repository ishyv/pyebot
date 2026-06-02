/**
 * Main-thread entry for the collect-then-apply engine.
 *
 * Transpiles the TS source (function body), runs it in a worker against a
 * snapshot, and returns the script's value plus a validated operation plan. The
 * worker timeout is the loop guard: raw JS can't be step-counted, so a runaway
 * script is bounded by wall-clock time and `worker.terminate()`.
 */
import type { Capability, ScriptSnapshot, WorkerResponse } from "./api";
import { type Operation, OperationsSchema } from "./operations";

export interface ExecuteOptions {
  /** Wall-clock limit before the worker is killed. Default 1000ms. */
  readonly timeoutMs?: number;
  /** Hard cap on recorded operations before the script is aborted. Default 1000. */
  readonly maxOperations?: number;
}

export interface ExecutionResult {
  readonly value: unknown;
  readonly operations: Operation[];
}

let transpiler: Bun.Transpiler | null = null;

function transpile(source: string): string {
  transpiler ??= new Bun.Transpiler({ loader: "ts" });
  return transpiler.transformSync(source);
}

function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!value || typeof value !== "object" || !("ok" in value)) return false;
  const ok = (value as { ok: unknown }).ok;
  if (ok === true) return "value" in value && "operations" in value;
  return ok === false && typeof (value as { message?: unknown }).message === "string";
}

/**
 * Compile + run a script. Throws on compile error, runtime error, timeout, or
 * an invalid operation plan. The returned `value` is structured-clone-safe;
 * callers validate its shape for their own use.
 */
export async function execute(
  source: string,
  snapshot: ScriptSnapshot,
  capabilities: Capability[],
  options: ExecuteOptions = {},
): Promise<ExecutionResult> {
  const timeoutMs = options.timeoutMs ?? 1000;
  const maxOperations = options.maxOperations ?? 1000;

  let code: string;
  try {
    code = transpile(source);
  } catch (err) {
    throw new Error(
      `Script failed to compile: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const worker = new Worker(new URL("./exec-worker.ts", import.meta.url), { type: "module" });

  const execution = new Promise<WorkerResponse>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerResponse(event.data)) {
        reject(new Error("Script worker returned an invalid response"));
        return;
      }
      resolve(event.data);
    };
    worker.onerror = (event) => reject(new Error(event.message));
    worker.postMessage({ code, snapshot, capabilities, maxOperations });
  });

  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error("Script timeout")), timeoutMs);
  });

  const response = await Promise.race([execution, timeout]).finally(() => {
    if (handle) clearTimeout(handle);
    worker.terminate();
  });

  if (!response.ok) throw new Error(response.message);

  const operations = OperationsSchema.parse(response.operations);
  return { value: response.value, operations };
}

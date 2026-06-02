/**
 * Script runner.
 *
 * Scripts are stored as JavaScript function expressions that receive a small
 * `ScriptContext` and return an output object. This is a trust-boundary
 * compromise for server admins: output is validated in the parent process, and
 * execution happens in a worker so timeout can terminate CPU-bound loops.
 *
 * RISK: this is availability isolation, not a security sandbox. Admin-authored
 * JavaScript remains trusted code; do not expose this to untrusted users.
 *
 * NOTE: the `ScriptOutput` shape is currently embed-flavoured — the engine was
 * lifted out of the embeds feature unchanged. Later phases generalise the
 * context/output and add the collect-then-apply operation model.
 */
import { z } from "zod";

/** Stable data made available to a script. */
export interface ScriptContext {
  guild: { id: string; name: string; memberCount: number };
  channel: { id: string; name: string };
  timestamp: number;
  date: string; // "YYYY-MM-DD" UTC
  time: string; // "HH:MM" UTC
}

/** Validated subset of embed fields a script may override. */
export interface ScriptOutput {
  title?: string | null;
  description?: string | null;
  color?: number | null;
  footer?: string | null;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

const ScriptOutputSchema = z.object({
  title: z.string().max(256).nullable().optional(),
  description: z.string().max(4096).nullable().optional(),
  color: z.number().int().nullable().optional(),
  footer: z.string().max(2048).nullable().optional(),
  fields: z
    .array(
      z.object({
        name: z.string().max(256),
        value: z.string().max(1024),
        inline: z.boolean().optional(),
      }),
    )
    .optional(),
});

export interface RunScriptOptions {
  readonly timeoutMs?: number;
}

type WorkerResponse =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string };

function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!value || typeof value !== "object") return false;
  if (!("ok" in value)) return false;
  if ((value as { ok: unknown }).ok === true) return "value" in value;
  return (
    (value as { ok: unknown }).ok === false &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

/**
 * Executes a user-provided JavaScript function expression with the given context.
 *
 * Security note: Scripts are authored by server admins with `ManageMessages`;
 * this worker boundary is meant to protect bot availability, not to safely run
 * hostile JavaScript. The parent owns output validation and kills the worker
 * after the timeout.
 */
export async function runScript(
  script: string,
  ctx: ScriptContext,
  options: RunScriptOptions = {},
): Promise<ScriptOutput> {
  const timeoutMs = options.timeoutMs ?? 1000;
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

  const execution = new Promise<unknown>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerResponse(event.data)) {
        reject(new Error("Script worker returned an invalid response"));
        return;
      }
      if (!event.data.ok) {
        reject(new Error(event.data.message));
        return;
      }
      resolve(event.data.value);
    };
    worker.onerror = (event) => {
      reject(new Error(event.message));
    };
    worker.postMessage({ script, ctx });
  });

  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error("Script timeout")), timeoutMs);
  });

  const value = await Promise.race([execution, timeout]).finally(() => {
    if (handle) clearTimeout(handle);
    worker.terminate();
  });

  const parsed = ScriptOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Script output validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

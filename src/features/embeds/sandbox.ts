import { z } from "zod";

export interface ScriptContext {
  guild: { id: string; name: string; memberCount: number };
  channel: { id: string; name: string };
  timestamp: number;
  date: string; // "YYYY-MM-DD" UTC
  time: string; // "HH:MM" UTC
}

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

/**
 * Executes a user-provided JavaScript function expression with the given context.
 *
 * Security note: Scripts are authored by server admins with `ManageMessages` — they are already
 * trusted users. The function-based sandbox does not prevent CPU-bound abuse in tight loops; this
 * trade-off is acceptable given the trust model. The 1-second timeout prevents async hangs only.
 * Do not expose `process`, `require`, or any Bun globals — pass only the `ScriptContext` object.
 */
export async function runScript(script: string, ctx: ScriptContext): Promise<ScriptOutput> {
  const execution = new Promise<ScriptOutput>((resolve, reject) => {
    try {
      const result = new Function("ctx", `"use strict"; return (${script})(ctx);`)(ctx);
      Promise.resolve(result)
        .then((value) => {
          const parsed = ScriptOutputSchema.safeParse(value);
          if (!parsed.success) {
            reject(new Error(`Script output validation failed: ${parsed.error.message}`));
          } else {
            resolve(parsed.data);
          }
        })
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });

  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error("Script timeout")), 1000);
  });

  return Promise.race([execution, timeout]).finally(() => {
    if (handle) clearTimeout(handle);
  });
}

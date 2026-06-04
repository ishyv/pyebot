/**
 * Normalize a feature's `handlers.ts` default export into `RuntimeRegistration`s,
 * supporting BOTH authoring styles during the routing migration:
 *
 *   - new:    `defineHandlers([...])` → a registration array (instance is null).
 *   - legacy: a decorated class INSTANCE → read @On/@Handle/@Listen prototype
 *             metadata and bind each method.
 *
 * Shared by the loader (production) and capability-graph/CLI tests so both derive
 * routes identically.
 */

import { getHandleMetadata, getListenMetadata, getOnMetadata } from "../decorators";
import type { RuntimeRegistration } from "../types";
import { isFeatureHandlers, type Registration } from "./registry";

/** Map a new-style authoring `Registration` to the normalized runtime shape. */
export function fromRegistration(reg: Registration): RuntimeRegistration {
  switch (reg.kind) {
    case "component":
      return { kind: "component", prefix: reg.prefix, run: reg.run, method: reg.prefix };
    case "event":
      return { kind: "event", ctor: reg.ctor, run: reg.run, method: reg.ctor.name };
    case "listen":
      return { kind: "listen", event: reg.event, run: reg.run, method: reg.event };
  }
}

/**
 * Normalize whatever `handlers.ts` exported (a FeatureHandlers object, a decorated
 * class instance, or nothing) into the runtime registration list.
 */
export function registrationsFromHandlers(value: object | null): RuntimeRegistration[] {
  if (!value) return [];
  if (isFeatureHandlers(value)) return value.registrations.map(fromRegistration);
  return fromDecoratedClass(value);
}

/** Read @On/@Handle/@Listen metadata off a legacy handler instance and bind methods. */
function fromDecoratedClass(instance: object): RuntimeRegistration[] {
  const out: RuntimeRegistration[] = [];
  const bind = (methodKey: string): ((...args: unknown[]) => unknown) | null => {
    const method = (instance as Record<string, unknown>)[methodKey];
    return typeof method === "function"
      ? (method as (...args: unknown[]) => unknown).bind(instance)
      : null;
  };

  for (const entry of getHandleMetadata(instance)) {
    const run = bind(entry.methodKey);
    if (run) {
      out.push({
        kind: "component",
        prefix: entry.prefix,
        run: run as never,
        method: entry.methodKey,
      });
    }
  }
  for (const entry of getOnMetadata(instance)) {
    const run = bind(entry.methodKey);
    if (run)
      out.push({ kind: "event", ctor: entry.event, run: run as never, method: entry.methodKey });
  }
  for (const entry of getListenMetadata(instance)) {
    const run = bind(entry.methodKey);
    if (run)
      out.push({ kind: "listen", event: entry.event, run: run as never, method: entry.methodKey });
  }
  return out;
}

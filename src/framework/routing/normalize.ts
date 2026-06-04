/**
 * Normalize a feature's `handlers.ts` default export (a `defineHandlers([...])`
 * result) into `RuntimeRegistration`s. Shared by the loader (production) and the
 * capability-graph / CLI tests so both derive routes identically.
 */

import type { RuntimeRegistration } from "../types";
import { isFeatureHandlers, type Registration } from "./registry";

/** Map an authoring `Registration` to the normalized runtime shape. */
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

/** Normalize whatever `handlers.ts` exported into the runtime registration list. */
export function registrationsFromHandlers(value: object | null): RuntimeRegistration[] {
  if (!value || !isFeatureHandlers(value)) return [];
  return value.registrations.map(fromRegistration);
}

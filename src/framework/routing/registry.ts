/**
 * The classless handler model: a feature's `handlers.ts` default-exports a flat
 * list of registrations, one per trigger, built by these free-scope helpers:
 *
 *   export default defineHandlers([
 *     ...routeHandlers(routes, {
 *       greet: async (i, args, ctx) => { ... },   // component routes (typed args)
 *     }),
 *     on(MemberJoined,        async (event, ctx)   => { ... }), // framework bus
 *     listen("messageCreate", async (message, ctx) => { ... }), // raw discord.js
 *   ]);
 *
 * The loader normalizes this into `LoadedFeature.registrations`; bootstrap wires
 * each by `kind`. No class, no decorators.
 */

import type { ClientEvents } from "discord.js";
import type { BoundComponentHandler, Ctx, EventConstructor, EventHandler } from "../types";
import { decodeArgs } from "./decode";
import {
  type ArgsOf,
  type InteractionOf,
  type KindOf,
  type RouteEntry,
  type RouteInput,
  type RouteTable,
  routeMeta,
  type SchemaOf,
} from "./routes";

// ─── Registration union (consumed by the loader/bootstrap) ───────────────────
export type Registration =
  | { readonly kind: "component"; readonly prefix: string; readonly run: BoundComponentHandler }
  | { readonly kind: "event"; readonly ctor: EventConstructor; readonly run: EventHandler<unknown> }
  | {
      readonly kind: "listen";
      readonly event: string;
      readonly run: (...args: unknown[]) => void | Promise<void>;
    };

// ─── Event helpers ───────────────────────────────────────────────────────────
/** Listen to a framework bus event. The class is both the key and the payload type. */
export function on<E>(ctor: EventConstructor<E>, run: EventHandler<E>): Registration {
  return { kind: "event", ctor: ctor as EventConstructor, run: run as EventHandler<unknown> };
}

/** Listen to a raw discord.js client event. Args are typed from `ClientEvents`. */
export function listen<K extends keyof ClientEvents>(
  event: K,
  run: (...args: [...ClientEvents[K], Ctx]) => void | Promise<void>,
): Registration {
  return {
    kind: "listen",
    event: event as string,
    run: run as (...args: unknown[]) => void | Promise<void>,
  };
}

// ─── Component route handlers ────────────────────────────────────────────────
/** A typed handler map keyed by route name; each callback's args/interaction infer. */
export type ComponentHandlersFor<D extends Record<string, RouteInput>> = {
  [Name in keyof D]?: (
    interaction: InteractionOf<KindOf<D[Name]>>,
    args: ArgsOf<SchemaOf<D[Name]>>,
    ctx: Ctx,
  ) => Promise<void>;
};

/**
 * Turn a typed handler map into component registrations — one per handled route.
 * Each registration decodes the customId tail through the route's schema and skips
 * (silently) on a decode failure before invoking the handler.
 */
export function routeHandlers<NS extends string, D extends Record<string, RouteInput>>(
  routes: RouteTable<NS, D>,
  handlers: ComponentHandlersFor<D>,
): Registration[] {
  const entries = routes as unknown as Record<string, RouteEntry<NS, RouteInput>>;
  const map = handlers as Record<
    string,
    ((i: unknown, args: unknown, ctx: Ctx) => Promise<void>) | undefined
  >;
  const regs: Registration[] = [];

  for (const name of Object.keys(routeMeta(routes).def)) {
    const handler = map[name];
    if (!handler) continue;
    const { prefix, schema } = entries[name] as RouteEntry<NS, RouteInput>;

    regs.push({
      kind: "component",
      prefix,
      run: async (interaction, ctx) => {
        const customId = interaction.customId;
        if (!customId.startsWith(prefix)) return;
        const args = decodeArgs(schema, customId.slice(prefix.length));
        if (args === null) return; // stale / garbled id — skip
        await handler(interaction, args, ctx);
      },
    });
  }
  return regs;
}

// ─── The feature handlers wrapper (loader-validated) ─────────────────────────
export interface FeatureHandlers {
  readonly __txHandlers: true;
  readonly registrations: readonly Registration[];
}

/** Wrap a feature's registration list. `handlers.ts` default-exports this. */
export function defineHandlers(registrations: Registration[]): FeatureHandlers {
  return { __txHandlers: true, registrations };
}

/** Runtime guard the loader uses to tell the new export shape from the old class. */
export function isFeatureHandlers(value: unknown): value is FeatureHandlers {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __txHandlers?: unknown }).__txHandlers === true
  );
}

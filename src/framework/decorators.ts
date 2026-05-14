/**
 * `@On` and `@Handle` — the two method decorators a feature uses to declare
 * its event listeners and component-interaction routes.
 *
 * Why decorators (rather than a plain `on:` array in the manifest)?
 *
 *   - They live next to the handler body. Reading the handler tells you
 *     exactly what triggers it, no jumping to a manifest file.
 *   - Adding a new listener is dropping a new decorated method in the
 *     handlers class — no "register me too" list to update.
 *   - Type inference: the decorator's first argument fixes the event type,
 *     so the method signature stays typed by the developer's declaration.
 *
 * Why NOT `reflect-metadata`?
 *
 *   `reflect-metadata` is a 16KB dependency that ships a polyfill for a TC39
 *   proposal we do not otherwise use. We need exactly one thing: attach
 *   metadata to a class prototype that the loader can read back. A single
 *   `Symbol`-keyed array on the prototype does that in 20 lines with zero
 *   dependencies.
 *
 * Mechanism:
 *
 *   - `@On(EventClass)` pushes `{ event, methodKey }` onto
 *     `target[ON_METADATA]` (an array of entries on the prototype).
 *   - `@Handle("prefix:")` pushes `{ prefix, methodKey }` onto
 *     `target[HANDLE_METADATA]`.
 *   - The loader reads these arrays at bootstrap to wire the event bus and
 *     component router. Features themselves never read the metadata.
 *
 * Requirement: `tsconfig.json` must have `"experimentalDecorators": true`.
 * Legacy decorators are intentional — they are stable in TypeScript and
 * sufficient for what we need (method decoration, no field/class
 * transformation).
 */

import type { EventConstructor } from "./types";

/** Symbol key for the @On metadata array on a handlers-class prototype. */
export const ON_METADATA = Symbol("tx.framework.on");
/** Symbol key for the @Handle metadata array on a handlers-class prototype. */
export const ON_HANDLE = Symbol("tx.framework.handle");
/** Symbol key for the @Listen metadata array on a handlers-class prototype. */
export const ON_LISTEN = Symbol("tx.framework.listen");

/** Shape stored on `target[ON_METADATA]`. */
export interface OnMetadataEntry {
  readonly event: EventConstructor;
  readonly methodKey: string;
}

/** Shape stored on `target[ON_HANDLE]`. */
export interface HandleMetadataEntry {
  readonly prefix: string;
  readonly methodKey: string;
}

/** Shape stored on `target[ON_LISTEN]`. */
export interface ListenMetadataEntry {
  readonly event: string;
  readonly methodKey: string;
}

/**
 * Mark a method as a listener for the given event class.
 *
 * Usage:
 *   class FooHandlers {
 *     @On(FightEnded)
 *     async onFightEnded(e: FightEnded, ctx: Ctx) { ... }
 *   }
 */
export function On<E>(eventClass: EventConstructor<E>) {
  return function (target: object, propertyKey: string): void {
    const list = ((target as Record<symbol, unknown>)[ON_METADATA] as OnMetadataEntry[] | undefined) ?? [];
    const entry: OnMetadataEntry = { event: eventClass as EventConstructor, methodKey: propertyKey };
    (target as Record<symbol, unknown>)[ON_METADATA] = [...list, entry];
  };
}

/**
 * Mark a method as a router for component (button / select) interactions
 * whose customId starts with the given prefix.
 *
 * Usage:
 *   class FooHandlers {
 *     @Handle("trivia:")
 *     async onTriviaAnswer(interaction: ButtonInteraction, ctx: Ctx) { ... }
 *   }
 *
 * Matching is done by `customId.startsWith(prefix)`. The framework picks
 * the LONGEST matching prefix when multiple routes match — so `"market:"`
 * and `"market:confirm:"` can coexist and the more specific one wins.
 */
export function Handle(prefix: string) {
  return function (target: object, propertyKey: string): void {
    const list = ((target as Record<symbol, unknown>)[ON_HANDLE] as HandleMetadataEntry[] | undefined) ?? [];
    const entry: HandleMetadataEntry = { prefix, methodKey: propertyKey };
    (target as Record<symbol, unknown>)[ON_HANDLE] = [...list, entry];
  };
}

/**
 * Mark a method as a raw Discord.js client event listener (e.g. "messageCreate",
 * "messageReactionAdd"). Use this when the per-event-class framework events
 * are too coarse — for example, automod needs every single message, not just
 * a message-flagged event.
 *
 * The framework registers these via `client.on(event, handler)` during
 * bootstrap. The bound method receives the raw Discord event arguments plus
 * a Ctx as the last argument.
 *
 * Usage:
 *   class FooHandlers {
 *     @Listen("messageCreate")
 *     async onMessage(message: Message, ctx: Ctx) { ... }
 *   }
 */
export function Listen(event: string) {
  return function (target: object, propertyKey: string): void {
    const list = ((target as Record<symbol, unknown>)[ON_LISTEN] as ListenMetadataEntry[] | undefined) ?? [];
    const entry: ListenMetadataEntry = { event, methodKey: propertyKey };
    (target as Record<symbol, unknown>)[ON_LISTEN] = [...list, entry];
  };
}

/** Read @Listen metadata off a handlers-class instance's prototype. */
export function getListenMetadata(handlersInstance: object): ReadonlyArray<ListenMetadataEntry> {
  const proto = Object.getPrototypeOf(handlersInstance) as Record<symbol, unknown>;
  return (proto[ON_LISTEN] as ListenMetadataEntry[] | undefined) ?? [];
}

/** Read @On metadata off a handlers-class instance's prototype. */
export function getOnMetadata(handlersInstance: object): ReadonlyArray<OnMetadataEntry> {
  const proto = Object.getPrototypeOf(handlersInstance) as Record<symbol, unknown>;
  return (proto[ON_METADATA] as OnMetadataEntry[] | undefined) ?? [];
}

/** Read @Handle metadata off a handlers-class instance's prototype. */
export function getHandleMetadata(handlersInstance: object): ReadonlyArray<HandleMetadataEntry> {
  const proto = Object.getPrototypeOf(handlersInstance) as Record<symbol, unknown>;
  return (proto[ON_HANDLE] as HandleMetadataEntry[] | undefined) ?? [];
}

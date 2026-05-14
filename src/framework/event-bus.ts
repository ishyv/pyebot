/**
 * `EventBus` — typed, synchronous, in-process pub/sub keyed by event class.
 *
 * Why classes as routing keys?
 * Each event class's constructor is a unique runtime reference AND carries
 * the inferred payload type through TypeScript. We use the constructor as
 * the lookup key, which means:
 *   - No string event names to keep in sync (typos become compile errors).
 *   - The handler's `event` parameter is fully typed without casts.
 *
 * Dispatch model: when `emit(event)` is called, the bus walks every
 * registered listener for that event's constructor in registration order
 * (which is feature-load order) and awaits them sequentially.
 *
 * Queue-after-cycle: if a listener calls `ctx.emit(...)` (which delegates
 * here), that nested emit is NOT dispatched in the middle of the current
 * cycle. Instead, it is queued and dispatched after every listener for the
 * current event has finished. This prevents two pathologies:
 *   - Listener A emits Event2, listener for Event2 mutates state listener B
 *     is about to read — surprising and bug-friendly.
 *   - Infinite re-entry where listeners ping-pong forever.
 *
 * Errors: a single listener throwing does NOT stop the remaining listeners
 * for the same event. Failures are logged via the framework logger and
 * the dispatch continues. This matches Discord's robustness expectations
 * — one buggy feature should not silently break the others.
 */

import { createLogger } from "@/core/logger";
import type { EventConstructor, EventHandler } from "./types";

const log = createLogger("framework:event-bus");

type Listener = (event: unknown, ctx: unknown) => void | Promise<void>;

/**
 * The synchronous typed event bus. There is exactly one of these per running
 * bot — the World constructs it and exposes `emit` via Ctx.
 */
export class EventBus {
  /** constructor → array of listeners. Map preserves insertion order. */
  private readonly listeners = new Map<EventConstructor, Listener[]>();
  /** A dispatch cycle is in progress; nested emits accumulate here. */
  private dispatching = false;
  /** Pending events queued during a cycle, processed after it finishes. */
  private readonly queue: Array<{ event: unknown; ctx: unknown }> = [];

  /**
   * Register a listener. Use the EventClass itself as the key — this is the
   * mechanism `@On(EventClass)` uses under the hood.
   */
  on<E>(eventClass: EventConstructor<E>, handler: EventHandler<E>): void {
    const list = this.listeners.get(eventClass) ?? [];
    list.push(handler as Listener);
    this.listeners.set(eventClass, list);
  }

  /**
   * Emit an event. Resolves once all listeners for this event have completed.
   * If a listener emits a new event, that event is queued and dispatched
   * after the current cycle.
   */
  async emit<E extends object>(event: E, ctx: unknown): Promise<void> {
    if (this.dispatching) {
      this.queue.push({ event, ctx });
      return;
    }
    this.dispatching = true;
    try {
      await this.dispatchOne(event, ctx);
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) await this.dispatchOne(next.event, next.ctx);
      }
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchOne(event: unknown, ctx: unknown): Promise<void> {
    const ctor = (event as object).constructor as EventConstructor;
    const list = this.listeners.get(ctor);
    if (!list || list.length === 0) return;
    for (const listener of list) {
      try {
        await listener(event, ctx);
      } catch (err) {
        log.error(`Listener for ${ctor.name} threw — continuing dispatch.`, err);
      }
    }
  }

  /** Used by tests and the bootstrap to wipe state between runs. */
  clear(): void {
    this.listeners.clear();
    this.queue.length = 0;
    this.dispatching = false;
  }
}

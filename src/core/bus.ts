/**
 * Legacy dashboard event bridge.
 *
 * The active feature runtime uses `framework/event-bus` through `ctx.emit(...)`
 * and `@On(EventClass)` listeners. This string-keyed bus remains only for
 * paths that still need to push live moderation/appeal activity into the
 * embedded webapp/SSE bridge without pulling framework internals into webapp
 * code.
 *
 * Do not use this for new feature-to-feature runtime behavior. Add framework
 * event classes under `src/events` instead, then listen with `@On`.
 *
 * Dispatch is fire-and-forget: listener errors are logged but never propagate
 * to the emitter. That is intentional for dashboard notifications, where a
 * broken SSE subscriber must not break the moderation action that emitted it.
 */

import { createLogger } from "@/core/logger";

const log = createLogger("bus");

// ---------------------------------------------------------------------------
// Event union for the legacy dashboard bridge. Keep new runtime signals on the
// framework event bus unless the webapp explicitly needs an SSE projection.
// ---------------------------------------------------------------------------

export type BusEvent =
  | { type: "item:gathered"; userId: string; itemId: string; qty: number }
  | { type: "fight:won"; userId: string; opponentId: string }
  | { type: "recipe:crafted"; userId: string; recipeId: string; qty: number }
  | { type: "daily:claimed"; userId: string; streak: number }
  | { type: "coinflip:won"; userId: string }
  | { type: "trivia:won"; userId: string }
  | { type: "quest:completed"; userId: string; questId: string }
  | {
      type: "mod:action";
      guildId: string;
      userId: string;
      moderatorId: string;
      sanctionType: "BAN" | "KICK" | "TIMEOUT" | "WARN" | "RESTRICT" | "PARDON";
      caseId: number;
    }
  | {
      type: "appeal:decided";
      guildId: string;
      userId: string;
      caseId: number;
      reviewerId: string;
      status: "approved" | "denied";
    };

type BusListener<T extends BusEvent["type"]> = (
  event: Extract<BusEvent, { type: T }>,
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

/** Minimal string-keyed bridge for dashboard projections of already-committed actions. */
class EventBus {
  private readonly listeners = new Map<string, Set<BusListener<BusEvent["type"]>>>();

  on<T extends BusEvent["type"]>(type: T, listener: BusListener<T>): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as unknown as BusListener<BusEvent["type"]>);
  }

  emit(event: BusEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) return;
    for (const listener of set) {
      Promise.resolve(listener(event as never)).catch((err) => {
        log.error(`Listener error for event "${event.type}"`, err);
      });
    }
  }
}

export const bus = new EventBus();

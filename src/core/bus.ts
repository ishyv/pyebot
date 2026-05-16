/**
 * Typed event bus for cross-feature communication.
 *
 * Why a custom bus instead of Node's EventEmitter:
 * - EventEmitter is stringly-typed: listeners receive `any`, no narrowing.
 * - A discriminated union gives full TypeScript inference for both emitters and listeners.
 * - The implementation is ~30 lines — adding a dependency would be wasteful.
 *
 * Dispatch is fire-and-forget: listener errors are logged but never propagate to the emitter.
 * This means a quest DB write failing will never break a gather command succeeding.
 *
 * Usage:
 *   // Emitting (in a feature service):
 *   bus.emit({ type: "item:gathered", userId, itemId: mat.id, qty: mat.quantity });
 *
 *   // Listening (in a feature's onLoad hook):
 *   bus.on("item:gathered", async (e) => {
 *     await progressAllQuests(e.userId, { kind: "gather_item", itemId: e.itemId, qty: e.qty });
 *   });
 */

import { createLogger } from "@/core/logger";

const log = createLogger("bus");

// ---------------------------------------------------------------------------
// Event union — extend this as features need new cross-feature signals.
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

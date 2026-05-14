/**
 * Tests for the EventBus — listener registration, dispatch order, queue-
 * after-cycle semantics, and error isolation. No DB or Discord client
 * required.
 */

import { describe, expect, it } from "bun:test";
import { EventBus } from "./event-bus";

class EventA { constructor(public n: number) {} }
class EventB { constructor(public s: string) {} }

describe("EventBus", () => {
  it("invokes listeners registered for the event class only", async () => {
    const bus = new EventBus();
    const seenA: number[] = [];
    const seenB: string[] = [];
    bus.on(EventA, (e: EventA) => { seenA.push(e.n); });
    bus.on(EventB, (e: EventB) => { seenB.push(e.s); });

    await bus.emit(new EventA(1), {});
    await bus.emit(new EventB("x"), {});

    expect(seenA).toEqual([1]);
    expect(seenB).toEqual(["x"]);
  });

  it("calls multiple listeners in registration order", async () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on(EventA, () => { order.push("first"); });
    bus.on(EventA, () => { order.push("second"); });
    await bus.emit(new EventA(0), {});
    expect(order).toEqual(["first", "second"]);
  });

  it("queues nested emits and dispatches them after the current cycle", async () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on(EventA, async (_e: EventA, ctx: object) => {
      order.push("A-1");
      await (ctx as { emit: (e: object) => Promise<void> }).emit(new EventB("nested"));
      order.push("A-2");
    });
    bus.on(EventA, () => { order.push("A-other"); });
    bus.on(EventB, () => { order.push("B"); });

    // Construct a small ctx-like object that proxies emit back into the bus.
    const ctx = { emit: (e: object) => bus.emit(e, ctx) };

    await bus.emit(new EventA(0), ctx);
    // Both EventA listeners must complete before EventB runs.
    expect(order).toEqual(["A-1", "A-2", "A-other", "B"]);
  });

  it("does not stop on listener errors", async () => {
    const bus = new EventBus();
    const seen: number[] = [];
    bus.on(EventA, () => { throw new Error("boom"); });
    bus.on(EventA, (e: EventA) => { seen.push(e.n); });
    await bus.emit(new EventA(42), {});
    expect(seen).toEqual([42]);
  });
});

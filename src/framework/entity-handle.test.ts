/**
 * Behavioral coverage for the entity handle + per-interaction cache. These
 * protect the parts that are easy to get wrong: defaulted reads, read-your-own
 * -write within an interaction, load coalescing across components on the same
 * entity, and the cache-coherence rule for single-field writes.
 *
 * The Mongo `EntityStore` is replaced by an in-memory fake so the logic under
 * test runs without a database — the same boundary `world.ts` tests draw.
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { defineComponent, entity, parseComponentField } from "./entity";
import { EntityCache, EntityHandle } from "./entity-handle";
import type { EntityDoc, EntityStore } from "./entity-store";

const User = entity("users");
const Counter = defineComponent(User, "counter", z.object({ count: z.number().int().default(0) }));
const Wallet = defineComponent(User, "wallet", z.object({ coins: z.number().int().default(0) }));

/** In-memory stand-in for EntityStore that records how often it reads. */
function fakeStore() {
  const docs = new Map<string, EntityDoc>();
  let loads = 0;
  const store = {
    loadDoc: async (_kind: unknown, id: string) => {
      loads++;
      const doc = docs.get(id);
      return doc ? structuredClone(doc) : null;
    },
    setComponent: async (id: string, component: { name: string }, value: unknown) => {
      const doc = docs.get(id) ?? { _id: id };
      doc[component.name] = value;
      docs.set(id, doc);
    },
    updateComponent: async (
      id: string,
      // biome-ignore lint/suspicious/noExplicitAny: test fake mirrors the generic store signature
      component: any,
      partial: Record<string, unknown>,
    ) => {
      const doc = docs.get(id) ?? { _id: id };
      const current = (doc[component.name] as object) ?? parseComponentField(component, {});
      doc[component.name] = { ...current, ...partial };
      docs.set(id, doc);
      return structuredClone(doc);
    },
    removeComponent: async (id: string, component: { name: string }) => {
      const doc = docs.get(id);
      if (doc) delete doc[component.name];
    },
  };
  return { store: store as unknown as EntityStore, docs, loads: () => loads };
}

function handleFor(store: EntityStore, id: string): EntityHandle {
  return new EntityHandle(store, new EntityCache(store), User, id);
}

describe("EntityHandle", () => {
  it("get returns defaults for a brand-new entity", async () => {
    const { store } = fakeStore();
    expect(await handleFor(store, "u1").get(Counter)).toEqual({ count: 0 });
  });

  it("peek returns null until a component is stored", async () => {
    const { store } = fakeStore();
    const u = handleFor(store, "u1");
    expect(await u.peek(Counter)).toBeNull();
    await u.set(Counter, { count: 3 });
    expect(await u.peek(Counter)).toEqual({ count: 3 });
    expect(await u.has(Counter)).toBe(true);
  });

  it("update sees prior writes within the same interaction (read-your-own-write)", async () => {
    const { store } = fakeStore();
    const u = handleFor(store, "u1");
    await u.update(Counter, (c) => ({ count: c.count + 1 }));
    await u.update(Counter, (c) => ({ count: c.count + 1 }));
    expect(await u.get(Counter)).toEqual({ count: 2 });
  });

  it("loads an entity once and serves all its components from cache", async () => {
    const fake = fakeStore();
    fake.docs.set("u1", { _id: "u1", counter: { count: 5 }, wallet: { coins: 9 } });
    const u = handleFor(fake.store, "u1");
    expect(await u.get(Counter)).toEqual({ count: 5 });
    expect(await u.get(Wallet)).toEqual({ coins: 9 });
    expect(fake.loads()).toBe(1);
  });

  it("remove drops only the targeted component", async () => {
    const fake = fakeStore();
    fake.docs.set("u1", { _id: "u1", counter: { count: 5 }, wallet: { coins: 9 } });
    const u = handleFor(fake.store, "u1");
    await u.remove(Counter);
    expect(await u.peek(Counter)).toBeNull();
    expect(await u.get(Wallet)).toEqual({ coins: 9 });
  });
});

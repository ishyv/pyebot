/**
 * Live smoke test for the entity-component engine against the configured Mongo
 * (`MONGO_URI` / `DB_NAME`). It drives the real `Ctx` surface exactly as a
 * feature would — `ctx.of(...)`, `ctx.select(...)`, `ctx.transaction(...)` —
 * and verifies behavior the offline unit tests can't: actual Mongo round-trips,
 * the upsert/patch builder against the real `$setOnInsert`/`$set` parser, and
 * transaction commit + rollback (which need a replica set).
 *
 * It is isolated: all work happens in a throwaway collection that is dropped on
 * entry and exit, with synthetic ids, so production collections are untouched.
 *
 *   bun scripts/entity-smoke.ts
 */

import "dotenv/config";
import type { Client } from "discord.js";
import { z } from "zod";
import { disconnectDb, getDb } from "../src/core/db";
import { defineComponent, entity, World } from "../src/framework";

const PROBE = "__entity_smoke";
const Probe = entity(PROBE);
const Counter = defineComponent(Probe, "counter", z.object({ count: z.number().int().default(0) }));
const Wallet = defineComponent(Probe, "wallet", z.object({ coins: z.number().int().default(0) }));

let passed = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok)
    throw new Error(
      `FAIL: ${label}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`,
    );
  passed++;
  console.log(`  ok: ${label}`);
}

async function dropProbe(): Promise<void> {
  const db = await getDb();
  await db
    .collection(PROBE)
    .drop()
    .catch(() => {});
}

async function main(): Promise<void> {
  await dropProbe();
  const world = await World.create({} as Client);
  const ctx = world.forInteraction(null, "smoke");

  console.log("reads + defaulted get");
  check("fresh get is defaulted", await ctx.of(Probe, "u1").get(Counter), { count: 0 });
  check("fresh peek is null", await ctx.of(Probe, "u1").peek(Counter), null);

  console.log("functional update — read-your-own-write across the real DB");
  const u1 = ctx.of(Probe, "u1");
  await u1.update(Counter, (c) => ({ count: c.count + 1 }));
  await u1.update(Counter, (c) => ({ count: c.count + 1 }));
  check("two increments persisted", await u1.get(Counter), { count: 2 });

  console.log("a second component on the same entity (one document)");
  await u1.set(Wallet, { coins: 50 });
  // fresh ctx => no cache; both components must come back from the one document
  const fresh = world.forInteraction(null, "smoke").of(Probe, "u1");
  check("counter survived", await fresh.get(Counter), { count: 2 });
  check("wallet survived", await fresh.get(Wallet), { coins: 50 });
  check("has(counter)", await fresh.has(Counter), true);

  console.log("select — cross-entity leaderboard");
  await ctx.of(Probe, "a").set(Counter, { count: 5 });
  await ctx.of(Probe, "b").set(Counter, { count: 9 });
  await ctx.of(Probe, "c").set(Counter, { count: 1 });
  const top = await ctx
    .select(Counter)
    .sortDesc((c) => c.count)
    .limit(2)
    .run();
  check(
    "leaderboard ids + counts (desc, limit 2)",
    top.map((r) => [r.id, r.value.count]),
    [
      ["b", 9],
      ["a", 5],
    ],
  );

  console.log("transaction — atomic cross-entity commit");
  await ctx.of(Probe, "rich").set(Counter, { count: 10 });
  await ctx.of(Probe, "poor").set(Counter, { count: 0 });
  await ctx.transaction(async (tx) => {
    await tx.of(Probe, "rich").update(Counter, (c) => ({ count: c.count - 3 }));
    await tx.of(Probe, "poor").update(Counter, (c) => ({ count: c.count + 3 }));
  });
  check("debited committed", await world.forInteraction(null).of(Probe, "rich").get(Counter), {
    count: 7,
  });
  check("credited committed", await world.forInteraction(null).of(Probe, "poor").get(Counter), {
    count: 3,
  });

  console.log("transaction — rollback leaves no partial write");
  await ctx
    .transaction(async (tx) => {
      await tx.of(Probe, "rich").update(Counter, (c) => ({ count: c.count - 5 }));
      throw new Error("boom");
    })
    .catch(() => {});
  check(
    "rolled back to pre-transaction value",
    await world.forInteraction(null).of(Probe, "rich").get(Counter),
    { count: 7 },
  );

  console.log("remove drops only the targeted component");
  await fresh.remove(Counter);
  const afterRemove = world.forInteraction(null, "smoke").of(Probe, "u1");
  check("counter removed", await afterRemove.peek(Counter), null);
  check("wallet intact", await afterRemove.get(Wallet), { coins: 50 });
}

main()
  .then(async () => {
    await dropProbe();
    await disconnectDb();
    console.log(`\nALL ${passed} CHECKS PASSED`);
    process.exit(0);
  })
  .catch(async (err) => {
    await dropProbe().catch(() => {});
    await disconnectDb().catch(() => {});
    console.error(`\n${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });

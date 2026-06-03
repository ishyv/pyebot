import { describe, expect, test } from "bun:test";
import type { Client } from "discord.js";
import { ScriptDefinition, type ScriptDefinitionValue } from "@/components/script-definition";
import type { Component, ComponentRecord, Ctx } from "@/framework/types";
import { runScheduleSweep } from "./schedule";

const dueAt = new Date("2026-06-03T12:00:00.000Z");

function scheduledScript(): ComponentRecord<ScriptDefinitionValue> {
  return {
    _id: "guild-1:u-role-count",
    guildId: "guild-1",
    name: "u-role-count",
    description: "",
    source: "return 1;",
    capabilities: [],
    trigger: { kind: "schedule", intervalHours: 2 },
    reportChannelId: null,
    scheduleNextRunAt: dueAt,
    createdBy: "author-1",
    enabled: true,
    createdAt: dueAt,
    updatedAt: dueAt,
  };
}

function makeCtx(def: ComponentRecord<ScriptDefinitionValue>): { ctx: Ctx; writes: unknown[] } {
  const writes: unknown[] = [];
  const ctx = {
    async query<T>(component: Component<T>) {
      if (component.collection === ScriptDefinition.collection) return [def] as T[];
      return [];
    },
    async set<T>(id: string, component: Component<T>, value: T) {
      writes.push({ id, collection: component.collection, value });
    },
    async patch() {
      throw new Error("ctx.patch should not be used for ScriptDefinition updates");
    },
  } as unknown as Ctx;
  return { ctx, writes };
}

describe("runScheduleSweep", () => {
  test("advances scheduled scripts through ctx.set", async () => {
    const def = scheduledScript();
    const { ctx, writes } = makeCtx(def);
    const client = { guilds: { cache: { get: () => undefined } } } as unknown as Client;

    await runScheduleSweep(client, ctx);

    expect(writes).toHaveLength(1);
    const write = writes[0] as { id: string; collection: string; value: ScriptDefinitionValue };
    expect(write.id).toBe(def._id);
    expect(write.collection).toBe(ScriptDefinition.collection);
    expect(write.value).toMatchObject({
      guildId: "guild-1",
      name: "u-role-count",
      trigger: { kind: "schedule", intervalHours: 2 },
      createdBy: "author-1",
      source: "return 1;",
    });
    expect(write.value.scheduleNextRunAt?.getTime()).toBeGreaterThan(Date.now());
  });
});

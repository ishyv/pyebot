import { describe, expect, test } from "bun:test";
import {
  ScriptDefinition,
  type ScriptDefinitionValue,
  scriptId,
} from "@/components/script-definition";
import type { Component, Ctx } from "@/framework/types";
import { saveExistingScript } from "./persistence";

const now = new Date("2026-06-03T12:00:00.000Z");

function script(overrides: Partial<ScriptDefinitionValue> = {}): ScriptDefinitionValue {
  return {
    guildId: "guild-1",
    name: "u-role-count",
    description: "old description",
    source: "return 1;",
    capabilities: [],
    trigger: { kind: "schedule", intervalHours: 6 },
    reportChannelId: "channel-1",
    scheduleNextRunAt: now,
    createdBy: "author-1",
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCtx(): { ctx: Ctx; writes: unknown[]; patchCalls: number } {
  const writes: unknown[] = [];
  let patchCalls = 0;
  const ctx = {
    async set<T>(id: string, component: Component<T>, value: T) {
      writes.push({ id, collection: component.collection, value });
    },
    async patch() {
      patchCalls += 1;
      throw new Error("ctx.patch should not be used for ScriptDefinition updates");
    },
  } as unknown as Ctx;
  return {
    ctx,
    writes,
    get patchCalls() {
      return patchCalls;
    },
  };
}

describe("saveExistingScript", () => {
  test("writes a merged stored script through ctx.set", async () => {
    const { ctx, writes, patchCalls } = makeCtx();
    const current = script();
    const updatedAt = new Date("2026-06-03T13:00:00.000Z");

    const saved = await saveExistingScript(ctx, scriptId(current.guildId, current.name), current, {
      description: "new description",
      source: "return 2;",
      updatedAt,
    });

    expect(patchCalls).toBe(0);
    expect(saved).toEqual({
      ...current,
      description: "new description",
      source: "return 2;",
      updatedAt,
    });
    expect(writes).toEqual([
      {
        id: "guild-1:u-role-count",
        collection: ScriptDefinition.collection,
        value: saved,
      },
    ]);
    expect(saved.createdBy).toBe("author-1");
    expect(saved.trigger).toEqual({ kind: "schedule", intervalHours: 6 });
    expect(saved.reportChannelId).toBe("channel-1");
    expect(saved.scheduleNextRunAt).toEqual(now);
  });
});

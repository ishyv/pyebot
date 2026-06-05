import { describe, expect, test } from "bun:test";
import type { Client } from "discord.js";
import { GuildScripts, type ScriptDefinitionValue } from "@/components/script-definition";
import type { Ctx } from "@/framework/types";
import { runScheduleSweep } from "./schedule";

const dueAt = new Date("2026-06-03T12:00:00.000Z");

function scheduledScript(): ScriptDefinitionValue {
  return {
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

/** Backs select() (the scheduler's cross-guild scan) and of().update (the write-back). */
function makeCtx(def: ScriptDefinitionValue): { ctx: Ctx; read: () => ScriptDefinitionValue } {
  const entries: Record<string, ScriptDefinitionValue> = { [def.name]: def };
  const ctx = {
    select() {
      return { run: async () => [{ id: def.guildId, value: { entries } }] };
    },
    of(_kind: unknown, _id: string) {
      return {
        async get() {
          return { entries };
        },
        async update(component: unknown, patch: unknown) {
          if (component !== GuildScripts) throw new Error("unexpected component in test ctx");
          const partial = typeof patch === "function" ? patch({ entries }) : patch;
          Object.assign(
            entries,
            (partial as { entries: Record<string, ScriptDefinitionValue> }).entries,
          );
        },
      };
    },
  } as unknown as Ctx;
  return { ctx, read: () => entries["u-role-count"] };
}

describe("runScheduleSweep", () => {
  test("advances scheduled scripts past now", async () => {
    const { ctx, read } = makeCtx(scheduledScript());
    const client = { guilds: { cache: { get: () => undefined } } } as unknown as Client;

    await runScheduleSweep(client, ctx);

    const saved = read();
    expect(saved).toMatchObject({
      guildId: "guild-1",
      name: "u-role-count",
      trigger: { kind: "schedule", intervalHours: 2 },
      createdBy: "author-1",
      source: "return 1;",
    });
    expect(saved.scheduleNextRunAt?.getTime()).toBeGreaterThan(Date.now());
  });
});

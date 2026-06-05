import { describe, expect, test } from "bun:test";
import { GuildScripts, type ScriptDefinitionValue } from "@/components/script-definition";
import type { Ctx } from "@/framework/types";
import {
  deleteStoredScript,
  findDueScheduledScripts,
  findEventScripts,
  getStoredScript,
  listGuildScripts,
  putScript,
  saveExistingScript,
} from "./persistence";

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

/** In-memory ctx backing the GuildScripts component, keyed by guild id. */
function makeCtx(seed: ScriptDefinitionValue[] = []): Ctx {
  const guilds = new Map<string, Record<string, ScriptDefinitionValue>>();
  for (const s of seed) {
    const entries = guilds.get(s.guildId) ?? {};
    entries[s.name] = s;
    guilds.set(s.guildId, entries);
  }
  return {
    of(_kind: unknown, id: string) {
      return {
        async get(component: unknown) {
          if (component !== GuildScripts) throw new Error("unexpected component in test ctx");
          return { entries: guilds.get(id) ?? {} };
        },
        async update(component: unknown, patch: unknown) {
          if (component !== GuildScripts) throw new Error("unexpected component in test ctx");
          const current = { entries: guilds.get(id) ?? {} };
          const partial = typeof patch === "function" ? patch(current) : patch;
          guilds.set(id, (partial as { entries: Record<string, ScriptDefinitionValue> }).entries);
        },
      };
    },
    select() {
      return {
        run: async () =>
          Array.from(guilds.entries()).map(([id, entries]) => ({ id, value: { entries } })),
      };
    },
  } as unknown as Ctx;
}

describe("saveExistingScript", () => {
  test("merges a patch and writes the script back", async () => {
    const current = script();
    const ctx = makeCtx([current]);
    const updatedAt = new Date("2026-06-03T13:00:00.000Z");

    const saved = await saveExistingScript(ctx, current, {
      description: "new description",
      source: "return 2;",
      updatedAt,
    });

    expect(saved).toEqual({
      ...current,
      description: "new description",
      source: "return 2;",
      updatedAt,
    });
    expect(await getStoredScript(ctx, "guild-1", "u-role-count")).toEqual(saved);
  });
});

describe("getStoredScript / putScript / deleteStoredScript", () => {
  test("round-trips a script and removes it", async () => {
    const ctx = makeCtx();
    expect(await getStoredScript(ctx, "guild-1", "u-role-count")).toBeNull();

    await putScript(ctx, script());
    expect(await getStoredScript(ctx, "guild-1", "u-role-count")).not.toBeNull();

    await deleteStoredScript(ctx, "guild-1", "u-role-count");
    expect(await getStoredScript(ctx, "guild-1", "u-role-count")).toBeNull();
  });
});

describe("listGuildScripts", () => {
  test("returns only the requested guild's scripts", async () => {
    const ctx = makeCtx([
      script({ name: "a" }),
      script({ name: "b" }),
      script({ guildId: "guild-2", name: "c" }),
    ]);
    const names = (await listGuildScripts(ctx, "guild-1")).map((s) => s.name).sort();
    expect(names).toEqual(["a", "b"]);
  });
});

describe("findEventScripts", () => {
  test("matches enabled event-bound scripts for the guild and event", async () => {
    const ctx = makeCtx([
      script({ name: "join", trigger: { kind: "event", event: "member-join" } }),
      script({
        name: "join-off",
        enabled: false,
        trigger: { kind: "event", event: "member-join" },
      }),
      script({ name: "sched" }), // schedule trigger
    ]);
    const matched = (await findEventScripts(ctx, "guild-1", "member-join")).map((s) => s.name);
    expect(matched).toEqual(["join"]);
  });
});

describe("findDueScheduledScripts", () => {
  test("returns due scheduled scripts across guilds, skipping future and disabled", async () => {
    const past = new Date("2026-06-03T11:00:00.000Z");
    const future = new Date("2026-06-03T13:00:00.000Z");
    const ctx = makeCtx([
      script({ name: "due", scheduleNextRunAt: past }),
      script({ name: "future", scheduleNextRunAt: future }),
      script({ name: "disabled", enabled: false, scheduleNextRunAt: past }),
      script({ guildId: "guild-2", name: "due2", scheduleNextRunAt: past }),
    ]);
    const due = (await findDueScheduledScripts(ctx, now)).map((s) => s.name).sort();
    expect(due).toEqual(["due", "due2"]);
  });
});

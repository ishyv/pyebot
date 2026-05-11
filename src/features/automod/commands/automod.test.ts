import { describe, expect, it, mock } from "bun:test";
import { OkResult, ErrResult } from "@/core/result";

const updateCalls: Array<{
  guildId: string;
  paths: Record<string, unknown>;
  options: unknown;
}> = [];

let updateResult = OkResult(undefined);

mock.module("@/db/repositories/guilds", () => ({
  guildStore: {},
  ensureGuild: async () => OkResult(null),
  getGuild: async () => OkResult(null),
  patchGuild: async () => OkResult(null),
  updateGuildPaths: async (
    guildId: string,
    paths: Record<string, unknown>,
    options: unknown,
  ) => {
    updateCalls.push({ guildId, paths, options });
    return updateResult;
  },
}));

mock.module("@/features/adminPanels/panels", () => ({
  assertPanelPermission: async () => true,
  openAdminPanel: async () => undefined,
}));

function linkspamInteraction() {
  return {
    guildId: "guild-1",
    options: {
      getSubcommand: () => "linkspam",
      getString: (name: string, required?: boolean) => {
        const values: Record<string, string> = {
          action: "enable",
          response: "delete",
        };
        const value = values[name] ?? null;
        if (required && value === null) throw new Error(`missing ${name}`);
        return value;
      },
      getInteger: (name: string) => {
        const values: Record<string, number> = {
          max_links: 2,
          window_seconds: 5,
        };
        return values[name] ?? null;
      },
    },
    async deferReply() {
      throw new Error("automod commands must use ctx.respond instead of raw deferReply");
    },
    async editReply() {
      throw new Error("automod commands must use ctx.respond instead of raw editReply");
    },
  };
}

function fakeContext() {
  const calls: Array<{ method: string; payload?: unknown; options?: unknown }> = [];
  return {
    calls,
    ctx: {
      guildId: "guild-1",
      respond: {
        async defer(options: unknown) {
          calls.push({ method: "defer", options });
        },
        async send(payload: unknown) {
          calls.push({ method: "send", payload });
        },
        async fail(payload: unknown) {
          calls.push({ method: "fail", payload });
        },
      },
    },
  };
}

describe("/automod linkspam", () => {
  it("uses the framework responder and upserts the latest guild config shape", async () => {
    updateCalls.length = 0;
    updateResult = OkResult(undefined);
    const { execute } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await execute(linkspamInteraction() as never, ctx as never);

    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
    expect(updateCalls).toEqual([
      {
        guildId: "guild-1",
        paths: {
          "automod.linkSpam.enabled": true,
          "automod.linkSpam.maxLinks": 2,
          "automod.linkSpam.windowSeconds": 5,
          "automod.linkSpam.action": "delete",
        },
        options: { upsert: true },
      },
    ]);
  });

  it("reports persistence failures through the framework responder", async () => {
    updateCalls.length = 0;
    updateResult = ErrResult(new Error("db down"));
    const { execute } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await execute(linkspamInteraction() as never, ctx as never);

    expect(calls.map((call) => call.method)).toEqual(["defer", "fail"]);
  });
});

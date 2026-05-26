import { describe, expect, it } from "bun:test";
import { MessageFlags } from "discord.js";
import type { CommandModule } from "@/framework";
import { makeChatInputInteraction, makeCommandCtx, runCommandScenario } from "./command-harness";

describe("command test harness", () => {
  it("throws for missing required options and returns null for optional options", () => {
    const { interaction } = makeChatInputInteraction({
      commandName: "sample",
      options: { strings: { present: "value" } },
    });

    expect(interaction.options.getString("present", true)).toBe("value");
    expect(interaction.options.getString("missing")).toBeNull();
    expect(() => interaction.options.getString("missing", true)).toThrow("missing");
  });

  it("records ctx.respond lifecycle separately from raw interaction replies", async () => {
    const { ctx, calls } = makeCommandCtx();

    await ctx.respond.defer({ visibility: "ephemeral" });
    await ctx.respond.send({ content: "done" });

    expect(calls.respond).toEqual([
      { method: "defer", options: { visibility: "ephemeral" } },
      { method: "send", payload: { content: "done" } },
    ]);
  });

  it("records raw interaction lifecycle when a legacy command uses Discord methods directly", async () => {
    const { interaction, calls } = makeChatInputInteraction({ commandName: "legacy" });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply({ content: "done" });

    expect(calls.raw).toEqual([
      { method: "deferReply", payload: { flags: MessageFlags.Ephemeral } },
      { method: "editReply", payload: { content: "done" } },
    ]);
  });

  it("runs the actual command callback and enforces the expected response path", async () => {
    const command = {
      data: { name: "sample", toJSON: () => ({ name: "sample", options: [] }) },
      help: false,
      execute: async (_interaction: never, ctx: ReturnType<typeof makeCommandCtx>["ctx"]) => {
        await ctx.respond.send({ content: "ok" });
      },
    } satisfies CommandModule;

    const result = await runCommandScenario(command, {
      commandName: "sample",
      expectResponse: "ctx",
    });

    expect(result.calls.respond.map((call) => call.method)).toEqual(["send"]);
    expect(result.calls.raw).toEqual([]);
  });
});

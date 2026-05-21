import { describe, expect, it } from "bun:test";
import { runScript, type ScriptContext } from "./sandbox";

const mockCtx: ScriptContext = {
  guild: { id: "111", name: "Test Guild", memberCount: 42 },
  channel: { id: "222", name: "general" },
  timestamp: 1700000000000,
  date: "2023-11-14",
  time: "22:13",
};

describe("runScript", () => {
  it("happy path — returns guild name as title", async () => {
    const result = await runScript("(ctx) => ({ title: ctx.guild.name })", mockCtx);
    expect(result).toEqual({ title: "Test Guild" });
  });

  it(
    "timeout — never-resolving async script rejects with 'Script timeout'",
    async () => {
      await expect(runScript("async (ctx) => new Promise(() => {})", mockCtx)).rejects.toThrow(
        "Script timeout",
      );
    },
    { timeout: 2000 },
  );

  it("invalid shape — script returning a primitive is rejected", async () => {
    await expect(runScript("(ctx) => 42", mockCtx)).rejects.toThrow();
  });

  it("synchronous throw — error inside script propagates", async () => {
    await expect(runScript('(ctx) => { throw new Error("oops") }', mockCtx)).rejects.toThrow(
      "oops",
    );
  });

  it("field override — fields array validates correctly", async () => {
    const result = await runScript('(ctx) => ({ fields: [{ name: "n", value: "v" }] })', mockCtx);
    expect(result).toEqual({ fields: [{ name: "n", value: "v" }] });
  });

  it("empty output — {} is valid", async () => {
    const result = await runScript("(ctx) => ({})", mockCtx);
    expect(result).toEqual({});
  });

  it("oversized field name — name > 256 chars fails validation", async () => {
    const longName = "a".repeat(257);
    await expect(
      runScript(`(ctx) => ({ fields: [{ name: "${longName}", value: "v" }] })`, mockCtx),
    ).rejects.toThrow();
  });
});

import { describe, expect, it } from "bun:test";
import type { ScriptSnapshot } from "./api";
import { execute } from "./execute";

function snapshot(overrides: Partial<ScriptSnapshot> = {}): ScriptSnapshot {
  return {
    guild: { id: "g1", name: "Guild", memberCount: 3 },
    channel: { id: "c1", name: "general" },
    invoker: { id: "u1", tag: "admin#0001" },
    roles: [
      { id: "r-verified", name: "Verified" },
      { id: "r-vet", name: "Veteran" },
    ],
    channels: [{ id: "c1", name: "general" }],
    members: [
      { id: "u1", tag: "a#1", bot: false, roleIds: ["r-verified"], joinedAt: 0 },
      { id: "u2", tag: "b#2", bot: false, roleIds: ["r-verified"], joinedAt: 0 },
      { id: "u3", tag: "c#3", bot: true, roleIds: [], joinedAt: 0 },
    ],
    now: 1_000 * 86_400_000,
    ...overrides,
  };
}

describe("execute", () => {
  it("query — returns a value and records no operations", async () => {
    const result = await execute(
      'return ctx.members.filter((m) => m.has_role("Verified")).length;',
      snapshot(),
      [],
    );
    expect(result.value).toBe(2);
    expect(result.operations).toEqual([]);
  });

  it("strips TypeScript types before running", async () => {
    const result = await execute("const n: number = 41; return n + 1;", snapshot(), []);
    expect(result.value).toBe(42);
  });

  it("records add_role operations when the roles capability is granted", async () => {
    const result = await execute(
      'for (const m of ctx.members) { if (!m.bot) ctx.addRole(m, "Veteran"); }',
      snapshot(),
      ["roles"],
    );
    expect(result.operations).toEqual([
      { kind: "add_role", userId: "u1", role: "Veteran" },
      { kind: "add_role", userId: "u2", role: "Veteran" },
    ]);
  });

  it("omits mutating recorders when the capability is not granted", async () => {
    const result = await execute("return typeof ctx.addRole;", snapshot(), []);
    expect(result.value).toBe("undefined");
  });

  it("normalizes a missing return value to null", async () => {
    const result = await execute("const x = 1;", snapshot(), []);
    expect(result.value).toBeNull();
  });

  it("propagates a runtime error", async () => {
    await expect(execute('throw new Error("boom");', snapshot(), [])).rejects.toThrow("boom");
  });

  it("reports a compile error", async () => {
    await expect(execute("return (((;", snapshot(), [])).rejects.toThrow(/compile/);
  });

  it(
    "aborts an infinite loop via the timeout",
    async () => {
      await expect(execute("while (true) {}", snapshot(), [], { timeoutMs: 50 })).rejects.toThrow(
        "Script timeout",
      );
    },
    { timeout: 2000 },
  );

  it("aborts when the operation budget is exceeded", async () => {
    await expect(
      execute(
        'for (let i = 0; i < 100; i++) ctx.addRole(ctx.members[0], "Veteran");',
        snapshot(),
        ["roles"],
        { maxOperations: 10 },
      ),
    ).rejects.toThrow(/budget/);
  });
});

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
    input: {},
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

  it("ctx.input — script reads pre-collected input values", async () => {
    const result = await execute(
      "return ctx.input.role;",
      snapshot({ input: { role: "Veteran" } }),
      [],
    );
    expect(result.value).toBe("Veteran");
  });

  it("ctx.find_role — resolves a role by name", async () => {
    const result = await execute('return ctx.find_role("Veteran")?.name;', snapshot(), []);
    expect(result.value).toBe("Veteran");
  });

  it('ctx.find_role — resolves "@Name" prefix', async () => {
    const result = await execute('return ctx.find_role("@Veteran")?.id;', snapshot(), []);
    expect(result.value).toBe("r-vet");
  });

  it("ctx.members_with_role — filters correctly", async () => {
    const result = await execute(
      'return ctx.members_with_role("Verified").length;',
      snapshot(),
      [],
    );
    expect(result.value).toBe(2);
  });

  it("m.mention — returns Discord mention string", async () => {
    const result = await execute("return ctx.members[0].mention();", snapshot(), []);
    expect(result.value).toBe("<@u1>");
  });

  it("m.role_names — returns role names for the member", async () => {
    const result = await execute("return ctx.members[0].role_names();", snapshot(), []);
    expect(result.value).toEqual(["Verified"]);
  });

  it("input.text — no-op at runtime, does not throw", async () => {
    const result = await execute('input.text("role", "Role to check"); return 42;', snapshot(), []);
    expect(result.value).toBe(42);
  });
});

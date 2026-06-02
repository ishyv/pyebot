import { describe, expect, it } from "bun:test";
import { Collection, type Guild } from "discord.js";
import { applyOperations } from "./apply";
import type { Operation } from "./operations";

type Recorded = string[];

/** Minimal guild stand-in that records the calls `applyOperations` makes. */
function fakeGuild(recorded: Recorded): Guild {
  const roles = new Collection<string, { id: string; name: string }>();
  roles.set("r-vet", { id: "r-vet", name: "Veteran" });

  return {
    roles: {
      cache: roles,
      create: async (opts: { name: string }) => {
        recorded.push(`create_role:${opts.name}`);
        return { id: "r-new" };
      },
    },
    members: {
      fetch: async (id: string) => {
        if (id === "missing") throw new Error("Unknown Member");
        return {
          id,
          roles: {
            add: async (roleId: string) => recorded.push(`add:${id}:${roleId}`),
            remove: async (roleId: string) => recorded.push(`remove:${id}:${roleId}`),
          },
          send: async (content: string) => recorded.push(`dm:${id}:${content}`),
        };
      },
    },
    channels: {
      create: async (opts: { name: string }) => recorded.push(`create_channel:${opts.name}`),
    },
  } as unknown as Guild;
}

describe("applyOperations", () => {
  it("dry-run performs zero mutations and reports every op as ok", async () => {
    const recorded: Recorded = [];
    const ops: Operation[] = [
      { kind: "add_role", userId: "u1", role: "Veteran" },
      { kind: "dm", userId: "u2", content: "hi" },
    ];
    const report = await applyOperations(fakeGuild(recorded), ops, { dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.applied).toBe(2);
    expect(report.failed).toBe(0);
    expect(recorded).toEqual([]);
  });

  it("resolves a role by name and adds it", async () => {
    const recorded: Recorded = [];
    const report = await applyOperations(fakeGuild(recorded), [
      { kind: "add_role", userId: "u1", role: "Veteran" },
    ]);

    expect(report.applied).toBe(1);
    expect(recorded).toEqual(["add:u1:r-vet"]);
  });

  it("records a per-op failure without aborting the rest", async () => {
    const recorded: Recorded = [];
    const report = await applyOperations(fakeGuild(recorded), [
      { kind: "add_role", userId: "missing", role: "Veteran" },
      { kind: "dm", userId: "u2", content: "hi" },
    ]);

    expect(report.applied).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.results[0]).toMatchObject({ ok: false });
    expect(report.results[1]).toMatchObject({ ok: true });
    expect(recorded).toEqual(["dm:u2:hi"]);
  });

  it("fails an op whose role cannot be resolved", async () => {
    const recorded: Recorded = [];
    const report = await applyOperations(fakeGuild(recorded), [
      { kind: "add_role", userId: "u1", role: "Nonexistent" },
    ]);

    expect(report.failed).toBe(1);
    expect(report.results[0].error).toMatch(/Unknown role/);
  });
});

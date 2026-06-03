import { describe, expect, it } from "bun:test";
import { Collection, type Guild } from "discord.js";
import memberCount from "./library/member-count";
import { runSource, runStatic } from "./service";

/** Guild that serves two members and records any mutating call made on it. */
function fakeGuild(recorded: string[]): Guild {
  const members = new Collection<string, unknown>();
  for (const id of ["u1", "u2"]) {
    members.set(id, {
      id,
      user: { tag: `${id}#0`, bot: false },
      roles: { cache: new Collection() },
      joinedTimestamp: 0,
    });
  }

  const roles = new Collection<string, { id: string; name: string }>();
  roles.set("r-vet", { id: "r-vet", name: "Veteran" });

  return {
    id: "g1",
    name: "Guild",
    memberCount: 2,
    members: {
      fetch: async (id?: string) => {
        if (id === undefined) return members;
        recorded.push(`fetch:${id}`);
        return {
          id,
          roles: { add: async (rid: string) => recorded.push(`add:${id}:${rid}`) },
        };
      },
    },
    roles: { cache: roles },
    channels: { cache: new Collection() },
  } as unknown as Guild;
}

describe("runSource", () => {
  it("returns the script value and applies no ops for a query", async () => {
    const recorded: string[] = [];
    const result = await runSource(fakeGuild(recorded), "return ctx.members.length;", []);

    expect(result.value).toBe(2);
    expect(result.operations).toEqual([]);
    expect(result.report.applied).toBe(0);
    expect(recorded.filter((c) => c.startsWith("add:"))).toEqual([]);
  });

  it("applies recorded operations against the guild", async () => {
    const recorded: string[] = [];
    const result = await runSource(
      fakeGuild(recorded),
      'for (const m of ctx.members) ctx.addRole(m, "Veteran");',
      ["roles"],
    );

    expect(result.operations).toHaveLength(2);
    expect(result.report.applied).toBe(2);
    expect(recorded).toContain("add:u1:r-vet");
    expect(recorded).toContain("add:u2:r-vet");
  });

  it("dry-run records the plan but performs no mutation", async () => {
    const recorded: string[] = [];
    const result = await runSource(
      fakeGuild(recorded),
      'ctx.addRole(ctx.members[0], "Veteran");',
      ["roles"],
      { dryRun: true },
    );

    expect(result.report.dryRun).toBe(true);
    expect(result.report.applied).toBe(1);
    expect(recorded.filter((c) => c.startsWith("add:"))).toEqual([]);
  });
});

describe("runStatic", () => {
  it("runs a built-in script in-process against the snapshot", async () => {
    const result = await runStatic(fakeGuild([]), memberCount);
    // member-count returns an OutputItem[] DSL array; check it has content
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.operations).toEqual([]);
    // The object payload is the second item: { total, humans, bots }
    const items = result.value as unknown[];
    const kvItem = items.find((i) => typeof i === "object" && i !== null && !("_t" in i));
    expect(kvItem).toMatchObject({ total: 2, humans: 2, bots: 0 });
  });
});

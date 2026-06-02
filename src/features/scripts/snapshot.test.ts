import { describe, expect, it } from "bun:test";
import { Collection, type Guild } from "discord.js";
import { buildSnapshot } from "./snapshot";

function fakeGuild(): Guild {
  const members = new Collection<string, unknown>();
  members.set("u1", {
    id: "u1",
    user: { tag: "a#1", bot: false },
    roles: { cache: new Collection([["r-vet", {}]]) },
    joinedTimestamp: 1000,
  });
  members.set("u2", {
    id: "u2",
    user: { tag: "bot#2", bot: true },
    roles: { cache: new Collection() },
    joinedTimestamp: null,
  });

  const roles = new Collection<string, { id: string; name: string }>();
  roles.set("r-vet", { id: "r-vet", name: "Veteran" });
  const channels = new Collection<string, { id: string; name: string }>();
  channels.set("c1", { id: "c1", name: "general" });

  return {
    id: "g1",
    name: "Guild",
    memberCount: 2,
    members: { fetch: async () => members },
    roles: { cache: roles },
    channels: { cache: channels },
  } as unknown as Guild;
}

describe("buildSnapshot", () => {
  it("maps members, roles, and channels from the guild", async () => {
    const snap = await buildSnapshot(fakeGuild(), { invoker: { id: "u1", tag: "a#1" } });

    expect(snap.guild).toEqual({ id: "g1", name: "Guild", memberCount: 2 });
    expect(snap.invoker).toEqual({ id: "u1", tag: "a#1" });
    expect(snap.members).toEqual([
      { id: "u1", tag: "a#1", bot: false, roleIds: ["r-vet"], joinedAt: 1000 },
      { id: "u2", tag: "bot#2", bot: true, roleIds: [], joinedAt: null },
    ]);
    expect(snap.roles).toEqual([{ id: "r-vet", name: "Veteran" }]);
    expect(snap.channels).toEqual([{ id: "c1", name: "general" }]);
  });
});

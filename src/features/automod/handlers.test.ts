import { describe, expect, it } from "bun:test";
import { MemberJoined } from "@/events/member-joined";
import handlers from "./handlers";

describe("automod handlers", () => {
  it("wires message checks, join lifecycle, and expiry sweep as registrations", () => {
    const regs = handlers.registrations;

    expect(regs.some((r) => r.kind === "event" && r.ctor === MemberJoined)).toBe(true);

    const listenEvents = regs.filter((r) => r.kind === "listen").map((r) => r.event);
    expect(listenEvents).toEqual(
      expect.arrayContaining(["messageCreate", "guildMemberUpdate", "clientReady"]),
    );
  });
});

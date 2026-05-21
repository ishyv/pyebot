import { describe, expect, it } from "bun:test";
import { MemberJoined } from "@/events/member-joined";
import { getListenMetadata, getOnMetadata } from "@/framework/decorators";
import AutomodHandlers from "./handlers";

describe("automod handlers", () => {
  it("wires message checks, join lifecycle, and expiry sweep through decorators", () => {
    const handlers = new AutomodHandlers();

    expect(getOnMetadata(handlers).map((entry) => entry.event)).toContain(MemberJoined);
    expect(getListenMetadata(handlers).map((entry) => entry.event)).toEqual(
      expect.arrayContaining(["messageCreate", "guildMemberUpdate", "clientReady"]),
    );
  });
});

import { describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import { detectAiClassificationSignals } from "./aiDetector";

describe("automod AI detector", () => {
  it("does not call AI or emit signals when disabled", async () => {
    const config = GuildSchema.parse({ _id: "guild-1" }).automod;
    const signals = await detectAiClassificationSignals(
      {
        guild: { id: "guild-1" },
        author: { id: "user-1" },
        channelId: "channel-1",
        id: "message-1",
        content: "this message is long enough to classify but the detector is disabled",
      } as never,
      config,
    );

    expect(signals).toEqual([]);
  });
});

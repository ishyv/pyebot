import { describe, expect, it } from "bun:test";
import { parseReputationKeywords } from "./panels";

describe("reputation panel", () => {
  it("normalizes comma-separated keywords from the modal", () => {
    expect(parseReputationKeywords("thanks, +rep, thanks,gg")).toEqual(["thanks", "+rep", "gg"]);
  });

  it("rejects too many keywords instead of silently writing bad config", () => {
    const raw = Array.from({ length: 26 }, (_, index) => `kw${index}`).join(",");

    expect(() => parseReputationKeywords(raw)).toThrow("25");
  });
});

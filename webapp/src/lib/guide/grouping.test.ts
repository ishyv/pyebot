import { describe, expect, it } from "vitest";
import { groupTopicsByCapability } from "./grouping";
import type { GuideTopicMeta } from "./types";

const sample: GuideTopicMeta[] = [
  { id: "economy", title: "economy", summary: "", group: "engagement" },
  { id: "quick-start", title: "quick start", summary: "", group: "start" },
  { id: "moderation", title: "moderation", summary: "", group: "protection" },
];

describe("groupTopicsByCapability", () => {
  it("pins the start group first and orders the rest by the canonical sequence", () => {
    const groups = groupTopicsByCapability(sample);
    expect(groups.map((g) => g.id)).toEqual(["start", "protection", "engagement"]);
  });

  it("omits groups that have no topics", () => {
    const groups = groupTopicsByCapability([sample[0]]);
    expect(groups.map((g) => g.id)).toEqual(["engagement"]);
  });

  it("gives each group a lowercase label", () => {
    const groups = groupTopicsByCapability(sample);
    expect(groups.find((g) => g.id === "start")?.label).toBe("start here");
    expect(groups.every((g) => g.label === g.label.toLowerCase())).toBe(true);
  });
});

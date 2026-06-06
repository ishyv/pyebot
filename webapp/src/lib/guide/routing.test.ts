import { describe, expect, it } from "vitest";
import { findGuideTopic } from "./routing";
import { GUIDE_TOPICS } from "./topics";

describe("findGuideTopic", () => {
  it("resolves every public guide topic slug", () => {
    for (const topic of GUIDE_TOPICS) {
      expect(findGuideTopic(topic.id)?.topic).toBe(topic);
    }
  });

  it("returns neighboring topics in guide order", () => {
    const second = GUIDE_TOPICS[1];
    const resolved = findGuideTopic(second.id);

    expect(resolved?.prev).toBe(GUIDE_TOPICS[0]);
    expect(resolved?.next).toBe(GUIDE_TOPICS[2]);
  });

  it("rejects unknown topic slugs", () => {
    expect(findGuideTopic("nope")).toBeNull();
  });
});

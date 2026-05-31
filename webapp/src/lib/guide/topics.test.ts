import { describe, expect, it } from "vitest";
import { GUIDE_TOPICS } from "./topics";

// Self-contained contract: the bot's loaded feature ids (see repo CLAUDE.md).
// A topic may only reference a feature that actually exists.
const KNOWN_FEATURE_IDS = new Set([
  "adminPanels",
  "ai",
  "automod",
  "autoroles",
  "counting",
  "economy",
  "embeds",
  "moderation",
  "offers",
  "rpg",
  "tickets",
  "tycoon",
  "utility",
]);

const VALID_GROUPS = new Set([
  "start",
  "protection",
  "server_ops",
  "engagement",
  "publishing",
  "ai_tools",
]);

describe("GUIDE_TOPICS", () => {
  it("has unique ids", () => {
    const ids = GUIDE_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only valid group ids", () => {
    for (const t of GUIDE_TOPICS) expect(VALID_GROUPS.has(t.group)).toBe(true);
  });

  it("references only real feature ids", () => {
    for (const t of GUIDE_TOPICS) {
      if (t.featureId) expect(KNOWN_FEATURE_IDS.has(t.featureId)).toBe(true);
    }
  });

  it("uses guild-relative dashboard paths", () => {
    for (const t of GUIDE_TOPICS) {
      if (t.dashboardPath) expect(t.dashboardPath.startsWith("/")).toBe(true);
    }
  });

  it("keeps titles and summaries lowercase", () => {
    for (const t of GUIDE_TOPICS) {
      expect(t.title).toBe(t.title.toLowerCase());
      expect(t.summary).toBe(t.summary.toLowerCase());
    }
  });
});

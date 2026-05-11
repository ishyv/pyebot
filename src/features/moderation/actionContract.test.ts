import { describe, expect, it } from "bun:test";
import {
  MODERATION_ACTIONS,
  MODERATION_SOURCES,
  isDestructiveModerationAction,
  moderationActionLabel,
} from "./actionContract";

describe("moderation action contract", () => {
  it("declares the sources needed for manual, automod, appeal, escalation, and system actions", () => {
    expect(MODERATION_SOURCES).toEqual(["manual", "automod", "appeal", "escalation", "system"]);
  });

  it("declares destructive actions for authorization and confirmation gates", () => {
    expect(MODERATION_ACTIONS).toContain("BAN");
    expect(MODERATION_ACTIONS).toContain("CASE_DELETE");
    expect(isDestructiveModerationAction("BAN")).toBe(true);
    expect(isDestructiveModerationAction("LOCKDOWN")).toBe(true);
    expect(isDestructiveModerationAction("WARN")).toBe(false);
  });

  it("formats action labels for help and audit embeds", () => {
    expect(moderationActionLabel("VERIFY_KICK")).toBe("Verification kick");
    expect(moderationActionLabel("CASE_DELETE")).toBe("Case delete");
  });
});

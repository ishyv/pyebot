import { describe, expect, test } from "bun:test";

describe("appeals repository exports", () => {
  test("exports expected functions", async () => {
    const repo = await import("./appeals");
    expect(typeof repo.createAppeal).toBe("function");
    expect(typeof repo.getAppeal).toBe("function");
    expect(typeof repo.updateAppeal).toBe("function");
    expect(typeof repo.getPendingAppeals).toBe("function");
  });
});

describe("AppealSchema", () => {
  test("parses valid appeal", async () => {
    const { AppealSchema } = await import("../schemas/appeal");
    const raw = {
      _id: "appeal:g1:42",
      guildId: "g1",
      caseId: 42,
      userId: "u1",
      userTag: "TestUser#0001",
      submittedAt: new Date().toISOString(),
      reason: "I was wrongly banned",
      threadId: "t1",
      status: "pending",
    };
    const result = AppealSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  test("rejects reason over 2000 chars", async () => {
    const { AppealSchema } = await import("../schemas/appeal");
    const result = AppealSchema.safeParse({
      _id: "appeal:g1:1",
      guildId: "g1",
      caseId: 1,
      userId: "u1",
      userTag: "u",
      submittedAt: new Date().toISOString(),
      reason: "x".repeat(2001),
      threadId: "t1",
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  test("parses appeal with decision", async () => {
    const { AppealSchema } = await import("../schemas/appeal");
    const result = AppealSchema.safeParse({
      _id: "appeal:g1:1",
      guildId: "g1",
      caseId: 1,
      userId: "u1",
      userTag: "u",
      submittedAt: new Date().toISOString(),
      reason: "reason",
      threadId: "t1",
      status: "approved",
      decision: {
        reviewerId: "mod1",
        decidedAt: new Date().toISOString(),
        reasonCode: "served_time",
        note: "time served",
      },
    });
    expect(result.success).toBe(true);
  });
});

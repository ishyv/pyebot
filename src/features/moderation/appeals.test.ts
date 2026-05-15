import { describe, expect, test } from "bun:test";
import { buildQueuePayload } from "./appeals";
import type { Appeal } from "@/db/schemas/appeal";
import { MessageFlags } from "discord.js";

function makeAppeal(overrides: Partial<Omit<Appeal, "_id">> = {}): Appeal {
  const base = {
    guildId: "g1",
    caseId: 1,
    userId: "u1",
    userTag: "TestUser",
    submittedAt: new Date("2026-01-01").toISOString(),
    reason: "I was wrongly banned",
    threadId: "t1",
    status: "pending" as const,
    ...overrides,
  };
  return { _id: `appeal:${base.guildId}:${base.caseId}`, ...base };
}

describe("buildQueuePayload", () => {
  test("empty list returns mute container with 'No open appeals'", () => {
    const payload = buildQueuePayload([]);
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(payload.components.length).toBeGreaterThan(0);
    // Container should serialize without error
    const json = JSON.stringify(payload);
    expect(json).toContain("No open appeals");
  });

  test("single appeal produces a section with Review button", () => {
    const payload = buildQueuePayload([makeAppeal()]);
    const json = JSON.stringify(payload);
    expect(json).toContain("Case #1");
    expect(json).toContain("TestUser");
    expect(json).toContain("appeal:review:g1:1");
  });

  test("reason over 150 chars is truncated", () => {
    const appeal = makeAppeal({ reason: "x".repeat(200) });
    const payload = buildQueuePayload([appeal]);
    const json = JSON.stringify(payload);
    // Should not contain 200 x's in a row
    expect(json).not.toContain("x".repeat(200));
    expect(json).toContain("…");
  });

  test("more than 10 appeals shows overflow note", () => {
    const appeals = Array.from({ length: 12 }, (_, i) =>
      makeAppeal({ caseId: i + 1, userId: `u${i}` }),
    );
    const payload = buildQueuePayload(appeals);
    const json = JSON.stringify(payload);
    expect(json).toContain("+2 more");
  });
});

// Integration: schema round-trip
describe("Appeal schema round-trip", () => {
  test("pending appeal with all required fields validates correctly", async () => {
    const { AppealSchema } = await import("@/db/schemas/appeal");
    const appeal = {
      _id: "appeal:g1:99",
      guildId: "g1",
      caseId: 99,
      userId: "u1",
      userTag: "user",
      submittedAt: new Date().toISOString(),
      reason: "Please reconsider",
      threadId: "th1",
      status: "pending" as const,
    };
    const result = AppealSchema.safeParse(appeal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending");
      expect(result.data.decision).toBeUndefined();
    }
  });

  test("approved appeal with decision validates", async () => {
    const { AppealSchema } = await import("@/db/schemas/appeal");
    const appeal = {
      _id: "appeal:g1:100",
      guildId: "g1",
      caseId: 100,
      userId: "u2",
      userTag: "user2",
      submittedAt: new Date().toISOString(),
      reason: "I am innocent",
      threadId: "th2",
      status: "approved" as const,
      decision: {
        reviewerId: "mod1",
        decidedAt: new Date().toISOString(),
        reasonCode: "wrongful_punishment" as const,
        note: "User was correct",
      },
    };
    const result = AppealSchema.safeParse(appeal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decision?.reasonCode).toBe("wrongful_punishment");
    }
  });
});

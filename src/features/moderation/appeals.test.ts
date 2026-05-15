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

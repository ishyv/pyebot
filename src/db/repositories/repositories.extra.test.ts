/**
 * Tests for repository-level pure logic that doesn't require a live Mongo:
 *   - counting: countingStateId composition, default factory, schema
 *   - tempBans: TempBanSchema validation
 *   - smoke checks for the counting and tempBans repos not covered
 *     by repositories.test.ts
 *
 * Full functional tests against a real or in-memory Mongo are intentionally
 * out of scope — that would require either mongodb-memory-server (new dep)
 * or process-wide module mocks (cross-test contamination risk).
 */

import { describe, expect, test } from "bun:test";
import { CountingStateSchema, countingStateId, createDefaultCountingState } from "./counting";

describe("counting repository", () => {
  describe("countingStateId", () => {
    test("composes id as `guildId:channelId`", () => {
      expect(countingStateId("g1", "c1")).toBe("g1:c1");
      expect(countingStateId("987654321", "111222333")).toBe("987654321:111222333");
    });

    test("is deterministic — same inputs always yield same id", () => {
      expect(countingStateId("g", "c")).toBe(countingStateId("g", "c"));
    });

    test("different inputs yield different ids", () => {
      expect(countingStateId("g1", "c1")).not.toBe(countingStateId("g1", "c2"));
      expect(countingStateId("g1", "c1")).not.toBe(countingStateId("g2", "c1"));
    });
  });

  describe("createDefaultCountingState", () => {
    test("populates _id, guildId, channelId, and zeroes the expected value", () => {
      const state = createDefaultCountingState("guild-1", "channel-1");
      expect(state._id).toBe("guild-1:channel-1");
      expect(state.guildId).toBe("guild-1");
      expect(state.channelId).toBe("channel-1");
      expect(state.expectedValue).toBe(0);
      expect(state.lastUserId).toBeNull();
      expect(state.updatedAt).toBeInstanceOf(Date);
    });

    test("default validates as a parseable CountingStateSchema", () => {
      const state = createDefaultCountingState("g", "c");
      expect(CountingStateSchema.safeParse(state).success).toBe(true);
    });
  });

  describe("CountingStateSchema", () => {
    test("parses a fully-populated record", () => {
      const result = CountingStateSchema.safeParse({
        _id: "g:c",
        guildId: "g",
        channelId: "c",
        expectedValue: 42,
        lastUserId: "user-1",
        updatedAt: new Date(),
      });
      expect(result.success).toBe(true);
    });

    test("coerces invalid expectedValue to 0 via .catch", () => {
      const result = CountingStateSchema.safeParse({
        _id: "g:c",
        guildId: "g",
        channelId: "c",
        expectedValue: -5, // fails .min(0); .catch(0) recovers
        lastUserId: null,
        updatedAt: new Date(),
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.expectedValue).toBe(0);
    });

    test("coerces a missing lastUserId to null via .catch", () => {
      const result = CountingStateSchema.safeParse({
        _id: "g:c",
        guildId: "g",
        channelId: "c",
        expectedValue: 1,
        updatedAt: new Date(),
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.lastUserId).toBeNull();
    });

    test("rejects record missing required identity fields", () => {
      expect(CountingStateSchema.safeParse({ guildId: "g" }).success).toBe(false);
      expect(CountingStateSchema.safeParse({ _id: "x" }).success).toBe(false);
    });
  });
});

describe("tempBans repository", () => {
  test("TempBanSchema parses a valid record", async () => {
    const { TempBanSchema } = await import("../schemas/tempBan");
    const result = TempBanSchema.safeParse({
      _id: "g1:u1",
      guildId: "g1",
      userId: "u1",
      reason: "spam",
      moderatorId: "mod1",
      unbanAt: new Date(),
      bannedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  test("TempBanSchema coerces ISO date strings", async () => {
    const { TempBanSchema } = await import("../schemas/tempBan");
    const result = TempBanSchema.safeParse({
      _id: "g1:u1",
      guildId: "g1",
      userId: "u1",
      reason: "spam",
      moderatorId: "mod1",
      unbanAt: "2026-06-01T00:00:00.000Z",
      bannedAt: "2026-05-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unbanAt).toBeInstanceOf(Date);
      expect(result.data.bannedAt).toBeInstanceOf(Date);
    }
  });

  test("TempBanSchema rejects record missing required fields", async () => {
    const { TempBanSchema } = await import("../schemas/tempBan");
    expect(TempBanSchema.safeParse({ guildId: "g1" }).success).toBe(false);
  });
});

describe("repository module exports (smoke)", () => {
  test("counting repo exposes id helpers, schema, factory, and the mongo impl", async () => {
    const repo = await import("./counting");
    expect(typeof repo.countingStateId).toBe("function");
    expect(typeof repo.createDefaultCountingState).toBe("function");
    expect(repo.CountingStateSchema).toBeDefined();
    expect(typeof repo.mongoCountingStateRepository.getState).toBe("function");
    expect(typeof repo.mongoCountingStateRepository.setState).toBe("function");
  });

  test("tempBans repo exports expected functions and the store", async () => {
    const repo = await import("./tempBans");
    expect(typeof repo.createTempBan).toBe("function");
    expect(typeof repo.getTempBan).toBe("function");
    expect(typeof repo.deleteTempBan).toBe("function");
    expect(typeof repo.getExpiredTempBans).toBe("function");
    expect(typeof repo.tempBanStore).toBe("object");
  });
});

import { describe, expect, test } from "bun:test";
import { buildCorrelationId, buildCompositeId, buildProgressId, buildAchievementId, buildListingId } from "./ids";
import { msToHuman, getCooldownExpiry, isCooldownExpired, minutesToMs, hoursToMs, daysToMs } from "./time";
import { formatAmount, applyTaxRate, clamp, formatCurrencyAmount, isValidAmount } from "./currency";
import { parseDuration } from "./duration";

describe("ids", () => {
  test("buildCorrelationId returns a non-empty string", () => {
    expect(typeof buildCorrelationId()).toBe("string");
    expect(buildCorrelationId().length).toBeGreaterThan(0);
  });

  test("two buildCorrelationId calls produce different values", () => {
    expect(buildCorrelationId()).not.toBe(buildCorrelationId());
  });

  test("buildCompositeId joins parts with colon", () => {
    expect(buildCompositeId("a", "b", "c")).toBe("a:b:c");
  });

  test("buildProgressId returns userId:questId", () => {
    expect(buildProgressId("u1", "q1")).toBe("u1:q1");
  });

  test("buildAchievementId returns userId:achievementId", () => {
    expect(buildAchievementId("u1", "ach1")).toBe("u1:ach1");
  });

  test("buildListingId starts with 'listing:'", () => {
    expect(buildListingId()).toMatch(/^listing:/);
  });
});

describe("time", () => {
  test("msToHuman formats seconds", () => {
    expect(msToHuman(30_000)).toBe("30s");
  });

  test("msToHuman formats minutes", () => {
    expect(msToHuman(90_000)).toBe("1m");
  });

  test("msToHuman formats hours", () => {
    expect(msToHuman(3_600_000)).toBe("1h");
  });

  test("msToHuman formats hours and minutes", () => {
    expect(msToHuman(5_400_000)).toBe("1h 30m");
  });

  test("msToHuman formats days", () => {
    expect(msToHuman(86_400_000)).toBe("1d");
  });

  test("getCooldownExpiry returns a future timestamp", () => {
    const expiry = getCooldownExpiry(60_000);
    expect(expiry).toBeGreaterThan(Date.now());
  });

  test("isCooldownExpired returns false for future expiry", () => {
    expect(isCooldownExpired(Date.now() + 60_000)).toBe(false);
  });

  test("isCooldownExpired returns true for past expiry", () => {
    expect(isCooldownExpired(Date.now() - 1)).toBe(true);
  });

  test("minutesToMs converts correctly", () => {
    expect(minutesToMs(1)).toBe(60_000);
    expect(minutesToMs(30)).toBe(1_800_000);
  });

  test("hoursToMs converts correctly", () => {
    expect(hoursToMs(1)).toBe(3_600_000);
    expect(hoursToMs(24)).toBe(86_400_000);
  });

  test("daysToMs converts correctly", () => {
    expect(daysToMs(1)).toBe(86_400_000);
    expect(daysToMs(7)).toBe(604_800_000);
  });
});

describe("parseDuration", () => {
  test("parses seconds", () => {
    expect(parseDuration("10s")).toBe(10_000);
  });

  test("parses minutes", () => {
    expect(parseDuration("5m")).toBe(300_000);
  });

  test("parses hours", () => {
    expect(parseDuration("2h")).toBe(7_200_000);
  });

  test("parses days", () => {
    expect(parseDuration("3d")).toBe(3 * 86_400_000);
  });

  test("parses weeks", () => {
    expect(parseDuration("1w")).toBe(604_800_000);
  });

  test("is case-insensitive", () => {
    expect(parseDuration("5M")).toBe(300_000);
    expect(parseDuration("2H")).toBe(7_200_000);
  });

  test("trims whitespace", () => {
    expect(parseDuration("  10m  ")).toBe(600_000);
  });

  test("returns null for invalid format", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("10")).toBeNull();
    expect(parseDuration("m10")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });

  test("returns null for zero duration", () => {
    expect(parseDuration("0m")).toBeNull();
  });

  test("returns null when exceeding 28 days", () => {
    expect(parseDuration("29d")).toBeNull();
    expect(parseDuration("5w")).toBeNull();
  });

  test("accepts exactly 28 days", () => {
    expect(parseDuration("28d")).toBe(28 * 86_400_000);
  });
});

describe("currency", () => {
  test("formatAmount returns localized string", () => {
    expect(formatAmount(1000)).toBe("1,000");
  });

  test("formatAmount includes symbol", () => {
    expect(formatAmount(500, "💰")).toBe("💰 500");
  });

  test("applyTaxRate computes net and fee", () => {
    const { net, fee } = applyTaxRate(1000, 0.1);
    expect(fee).toBe(100);
    expect(net).toBe(900);
  });

  test("applyTaxRate floors the fee", () => {
    const { fee } = applyTaxRate(100, 0.15);
    expect(fee).toBe(15);
    expect(Number.isInteger(fee)).toBe(true);
  });

  test("clamp respects min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  test("clamp respects max", () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });

  test("clamp passes through valid values", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  test("formatCurrencyAmount uses symbol when provided", () => {
    const result = formatCurrencyAmount(500, "coins", { coins: "🪙" });
    expect(result).toContain("🪙");
    expect(result).toContain("500");
  });

  test("isValidAmount returns true for positive integers", () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(100)).toBe(true);
  });

  test("isValidAmount returns false for zero, negatives, and floats", () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(1.5)).toBe(false);
  });
});

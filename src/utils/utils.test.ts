import { describe, expect, test } from "bun:test";
import { buildCorrelationId, buildCompositeId, buildProgressId, buildAchievementId, buildListingId } from "./ids";
import { msToHuman, getCooldownExpiry, isCooldownExpired, minutesToMs, hoursToMs, daysToMs } from "./time";
import { formatAmount, applyTaxRate, clamp, formatCurrencyAmount, isValidAmount } from "./currency";

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

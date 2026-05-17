/**
 * Tests for tickets service exports that don't need a ctx mock:
 *   - TICKET_CATEGORIES catalog shape
 *   - makeTicketChannelName sanitization
 *   - TicketError class shape
 *
 * The openTicket / closeTicket flow is covered by service.test.ts.
 */

import { describe, expect, test } from "bun:test";
import { makeTicketChannelName, TICKET_CATEGORIES, TicketError } from "./service";

describe("TICKET_CATEGORIES", () => {
  test("has exactly the five categories shown in the panel", () => {
    expect(TICKET_CATEGORIES).toHaveLength(5);
  });

  test("each entry has the four fields the picker UI reads", () => {
    for (const cat of TICKET_CATEGORIES) {
      expect(typeof cat.id).toBe("string");
      expect(cat.id.length).toBeGreaterThan(0);
      expect(typeof cat.label).toBe("string");
      expect(typeof cat.description).toBe("string");
      expect(typeof cat.emoji).toBe("string");
    }
  });

  test("category ids are distinct (Discord select menus require unique values)", () => {
    const ids = TICKET_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("makeTicketChannelName", () => {
  test("lowercases and prefixes with 'ticket-'", () => {
    expect(makeTicketChannelName("Alice")).toBe("ticket-alice");
  });

  test("collapses internal whitespace to a single dash", () => {
    expect(makeTicketChannelName("Alice  Bob   Carol")).toBe("ticket-alice-bob-carol");
  });

  test("strips diacritics", () => {
    expect(makeTicketChannelName("José")).toBe("ticket-jose");
    expect(makeTicketChannelName("Zoë")).toBe("ticket-zoe");
  });

  test("strips characters outside [a-zA-Z0-9 -]", () => {
    expect(makeTicketChannelName("user@#$%^&*()")).toBe("ticket-user");
    expect(makeTicketChannelName("name.with.dots")).toBe("ticket-namewithdots");
  });

  test("falls back to 'ticket-user' for an all-symbols username", () => {
    expect(makeTicketChannelName("!!!")).toBe("ticket-user");
    expect(makeTicketChannelName("")).toBe("ticket-user");
  });

  test("truncates to 100 characters (Discord channel name limit)", () => {
    const huge = "a".repeat(500);
    const result = makeTicketChannelName(huge);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.startsWith("ticket-")).toBe(true);
  });

  test("preserves digits", () => {
    expect(makeTicketChannelName("user123")).toBe("ticket-user123");
  });
});

describe("TicketError", () => {
  test("carries name='TicketError', message, and code", () => {
    const err = new TicketError("nope", "LIMIT_REACHED");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TicketError");
    expect(err.message).toBe("nope");
    expect(err.code).toBe("LIMIT_REACHED");
  });

  test("accepts every documented code", () => {
    const codes = ["LIMIT_REACHED", "NO_CATEGORY", "DB_ERROR", "DISCORD_ERROR"] as const;
    for (const code of codes) {
      expect(new TicketError("x", code).code).toBe(code);
    }
  });
});

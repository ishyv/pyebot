/**
 * Tests for ticket close handler predicates + customId contract.
 *
 * `handleTicketClose` itself drives Discord I/O + DB; the service flow it
 * delegates to (`closeTicket`) already has coverage in service.test.ts. This
 * file focuses on the routing contract: that the component router picks the
 * right button, and that the prefix string isn't accidentally renamed.
 */

import { describe, expect, test } from "bun:test";
import { TICKET_CLOSE_BUTTON_PREFIX } from "../customIds";
import { isTicketCloseButton } from "./close";

describe("TICKET_CLOSE_BUTTON_PREFIX", () => {
  test("is 'tickets:close:' (pinned — handlers slice on this exact string)", () => {
    expect(TICKET_CLOSE_BUTTON_PREFIX).toBe("tickets:close:");
  });
});

describe("isTicketCloseButton", () => {
  test("matches the prefix with a channel id appended", () => {
    expect(isTicketCloseButton(`${TICKET_CLOSE_BUTTON_PREFIX}1234567890`)).toBe(true);
  });

  test("matches the bare prefix (predicate uses startsWith)", () => {
    expect(isTicketCloseButton(TICKET_CLOSE_BUTTON_PREFIX)).toBe(true);
  });

  test("rejects unrelated custom ids", () => {
    expect(isTicketCloseButton("offer:approve:abc")).toBe(false);
    expect(isTicketCloseButton("tickets:open:1234")).toBe(false);
    expect(isTicketCloseButton("")).toBe(false);
    expect(isTicketCloseButton("tickets")).toBe(false);
  });

  test("rejects look-alike prefixes", () => {
    expect(isTicketCloseButton("ticket:close:abc")).toBe(false); // singular
    expect(isTicketCloseButton("tickets_close:abc")).toBe(false);
    expect(isTicketCloseButton("tickets:closed:abc")).toBe(false);
  });
});

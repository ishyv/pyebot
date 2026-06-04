/**
 * Tests for the ticket close routing contract.
 *
 * `handleTicketClose` itself drives Discord I/O + DB; the service flow it
 * delegates to (`closeTicket`) already has coverage in service.test.ts. This
 * file pins the route's customId contract: the prefix string isn't accidentally
 * renamed, encode round-trips, and the decode rejects look-alikes.
 */

import { describe, expect, test } from "bun:test";
import { decodeArgs } from "@/framework/routing/decode";
import { routes } from "../routes";

describe("tickets close route", () => {
  test("prefix is 'tickets:close:' (pinned — live buttons route on this)", () => {
    expect(routes.close.prefix).toBe("tickets:close:");
  });

  test("encodes channel id into the customId", () => {
    expect(routes.close.id({ channel: "1234567890" })).toBe("tickets:close:1234567890");
  });

  test("decodes the channel id back out", () => {
    const id = routes.close.id({ channel: "1234567890" });
    const remainder = id.slice(routes.close.prefix.length);
    expect(decodeArgs(routes.close.schema, remainder)).toEqual({ channel: "1234567890" });
  });

  test("rejects a non-snowflake channel segment (skipped at decode)", () => {
    expect(decodeArgs(routes.close.schema, "not-a-snowflake")).toBeNull();
    expect(decodeArgs(routes.close.schema, "")).toBeNull();
  });
});

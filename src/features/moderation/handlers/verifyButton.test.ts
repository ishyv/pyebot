/**
 * Tests for the verify button predicate + customId contract.
 * The handleVerifyButton flow itself touches Discord (member fetch, role add)
 * and DB (getGuild), neither of which is mockable without invasive setup.
 * The predicate IS the routing contract — if it breaks, the verify gate stops working.
 */

import { describe, expect, test } from "bun:test";
import { isVerifyButton, VERIFY_PREFIX } from "./verifyButton";

describe("VERIFY_PREFIX", () => {
  test("is 'mod:verify:' (pinned — handler slices on this exact string)", () => {
    expect(VERIFY_PREFIX).toBe("mod:verify:");
  });
});

describe("isVerifyButton", () => {
  test("matches the prefix with a user id appended", () => {
    expect(isVerifyButton(`${VERIFY_PREFIX}1234567890`)).toBe(true);
  });

  test("matches the disabled-button sentinel 'mod:verify:_done' used after success", () => {
    // disableButton() rewrites the button with this customId so subsequent
    // clicks don't re-route to a real handler — but the predicate still
    // matches it, which is acceptable since the button is disabled.
    expect(isVerifyButton("mod:verify:_done")).toBe(true);
  });

  test("rejects unrelated custom ids", () => {
    expect(isVerifyButton("mod:appeal:guild:42")).toBe(false);
    expect(isVerifyButton("offer:approve:abc")).toBe(false);
    expect(isVerifyButton("")).toBe(false);
    expect(isVerifyButton("mod:verify")).toBe(false);
  });

  test("rejects look-alike prefixes", () => {
    expect(isVerifyButton("mod:verified:abc")).toBe(false);
    expect(isVerifyButton("mod_verify:abc")).toBe(false);
  });
});

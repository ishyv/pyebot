/**
 * Pins the customId contracts for appeal handlers.
 *
 * The framework component router matches buttons and modal submits by
 * `startsWith(prefix)`. A typo in any of these prefix constants silently
 * breaks the routing — the button shows up in Discord, the user clicks it,
 * and nothing happens. These tests prevent that by pinning the exact
 * literal strings.
 *
 * If a prefix legitimately needs to change, update both the constant AND
 * the corresponding line here in the same commit.
 */

import { describe, expect, test } from "bun:test";
import { APPEAL_BUTTON_PREFIX, APPEAL_SUBMIT_PREFIX } from "./appealButton";
import {
  APPEAL_APPROVE_MODAL_PREFIX,
  APPEAL_APPROVE_PREFIX,
  APPEAL_DENY_MODAL_PREFIX,
  APPEAL_DENY_PREFIX,
  APPEAL_INFO_MODAL_PREFIX,
  APPEAL_INFO_PREFIX,
  APPEAL_REVIEW_PREFIX,
} from "./appealReview";

describe("appeal customId prefixes — pinned contract", () => {
  test("appealButton.ts prefixes", () => {
    expect(APPEAL_BUTTON_PREFIX).toBe("mod:appeal:");
    expect(APPEAL_SUBMIT_PREFIX).toBe("mod:appeal-submit:");
  });

  test("appealReview.ts button prefixes", () => {
    expect(APPEAL_REVIEW_PREFIX).toBe("appeal:review:");
    expect(APPEAL_APPROVE_PREFIX).toBe("appeal:approve:");
    expect(APPEAL_DENY_PREFIX).toBe("appeal:deny:");
    expect(APPEAL_INFO_PREFIX).toBe("appeal:info:");
  });

  test("appealReview.ts modal-submit prefixes", () => {
    expect(APPEAL_APPROVE_MODAL_PREFIX).toBe("appeal:approve-modal:");
    expect(APPEAL_DENY_MODAL_PREFIX).toBe("appeal:deny-modal:");
    expect(APPEAL_INFO_MODAL_PREFIX).toBe("appeal:info-modal:");
  });

  test("no two prefixes are prefixes of each other", () => {
    // startsWith routing breaks if one prefix is a prefix of another:
    // the router would match the longer customId to whichever rule was
    // registered first, depending on iteration order.
    const all = [
      APPEAL_BUTTON_PREFIX,
      APPEAL_SUBMIT_PREFIX,
      APPEAL_REVIEW_PREFIX,
      APPEAL_APPROVE_PREFIX,
      APPEAL_DENY_PREFIX,
      APPEAL_INFO_PREFIX,
      APPEAL_APPROVE_MODAL_PREFIX,
      APPEAL_DENY_MODAL_PREFIX,
      APPEAL_INFO_MODAL_PREFIX,
    ];
    for (const a of all) {
      for (const b of all) {
        if (a === b) continue;
        // Either neither starts with the other, or they share no overlap.
        const aStartsB = a.startsWith(b);
        const bStartsA = b.startsWith(a);
        expect(aStartsB || bStartsA).toBe(false);
      }
    }
  });

  test("appeal-submit prefix does NOT collide with appeal button prefix", () => {
    // Critical: `mod:appeal-submit:` must not match `mod:appeal:` startsWith.
    // Without the trailing colon convention this would silently mis-route.
    expect(APPEAL_SUBMIT_PREFIX.startsWith(APPEAL_BUTTON_PREFIX)).toBe(false);
    // And the reverse: an APPEAL_BUTTON_PREFIX customId does NOT match the
    // APPEAL_SUBMIT_PREFIX prefix.
    expect(`${APPEAL_BUTTON_PREFIX}guild:42`.startsWith(APPEAL_SUBMIT_PREFIX)).toBe(false);
  });

  test("a full customId roundtrips through the prefix + suffix split", () => {
    // Documents the expected payload format used by handlers' parseIds():
    //   <prefix><guildId>:<caseId>
    const cid = `${APPEAL_REVIEW_PREFIX}guild-abc:42`;
    expect(cid.startsWith(APPEAL_REVIEW_PREFIX)).toBe(true);
    const rest = cid.slice(APPEAL_REVIEW_PREFIX.length);
    expect(rest).toBe("guild-abc:42");
    const idx = rest.lastIndexOf(":");
    expect(rest.slice(0, idx)).toBe("guild-abc");
    expect(Number(rest.slice(idx + 1))).toBe(42);
  });
});

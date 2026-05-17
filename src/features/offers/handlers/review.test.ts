/**
 * Tests for offer review handler predicates.
 *
 * Only `isOfferReviewButton` is exported as a pure function; the actual
 * `handleOfferReview` flow requires Discord interaction stubs + a real or
 * mocked service layer, which is out of scope here. The predicate IS the
 * thing the framework component router uses to decide whether to dispatch
 * a button to this handler at all — getting it right matters.
 */

import { describe, expect, test } from "bun:test";
import { OFFER_APPROVE_PREFIX, OFFER_CHANGES_PREFIX, OFFER_REJECT_PREFIX } from "../service";
import { isOfferReviewButton } from "./review";

describe("isOfferReviewButton", () => {
  test("matches the approve prefix with an id appended", () => {
    expect(isOfferReviewButton(`${OFFER_APPROVE_PREFIX}abcd1234`)).toBe(true);
  });
  test("matches the reject prefix with an id appended", () => {
    expect(isOfferReviewButton(`${OFFER_REJECT_PREFIX}abcd1234`)).toBe(true);
  });
  test("matches the changes prefix with an id appended", () => {
    expect(isOfferReviewButton(`${OFFER_CHANGES_PREFIX}abcd1234`)).toBe(true);
  });

  test("matches the bare prefix without an id (edge case the predicate accepts)", () => {
    // Documenting current behavior: predicate uses startsWith, so a malformed
    // customId with no offer id still passes the predicate. The handler then
    // calls slice() with an empty id, which the service rejects as NOT_FOUND.
    expect(isOfferReviewButton(OFFER_APPROVE_PREFIX)).toBe(true);
  });

  test("rejects unrelated custom ids", () => {
    expect(isOfferReviewButton("ticket:close:42")).toBe(false);
    expect(isOfferReviewButton("offer:other:abc")).toBe(false);
    expect(isOfferReviewButton("")).toBe(false);
    expect(isOfferReviewButton("offer")).toBe(false);
  });

  test("rejects prefixes that LOOK similar but are not exact", () => {
    expect(isOfferReviewButton("offer_approve:abc")).toBe(false);
    expect(isOfferReviewButton("offer:approved:abc")).toBe(false);
  });
});

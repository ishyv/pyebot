/**
 * Tests for the Offers service surface that doesn't require Discord or Mongo:
 *   - OfferSchema / OfferDetailsSchema validation
 *   - OfferStatusSchema enum membership
 *   - OfferError class shape
 *   - Button customId prefix constants (handlers depend on these — a typo here
 *     would silently break the review buttons in production)
 *
 * Service flow tests (createOffer / approveOffer / etc.) are deliberately not
 * mocked here because they instantiate a module-level MongoStore that would
 * require process-wide `mock.module` of @/db/store — which has cross-test
 * contamination risk per the note in market.test.ts.
 */

import { describe, expect, test } from "bun:test";
import {
  OFFER_APPROVE_PREFIX,
  OFFER_CHANGES_PREFIX,
  OFFER_REJECT_PREFIX,
  OfferDetailsSchema,
  OfferError,
  OfferSchema,
  OfferStatusSchema,
} from "./service";

describe("OfferStatusSchema", () => {
  test("accepts every documented status", () => {
    const statuses = [
      "PENDING_REVIEW",
      "APPROVED",
      "REJECTED",
      "CHANGES_REQUESTED",
      "WITHDRAWN",
    ] as const;
    for (const s of statuses) {
      expect(OfferStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  test("rejects unknown status", () => {
    expect(OfferStatusSchema.safeParse("PENDING").success).toBe(false);
    expect(OfferStatusSchema.safeParse("").success).toBe(false);
    expect(OfferStatusSchema.safeParse(null).success).toBe(false);
  });
});

describe("OfferDetailsSchema", () => {
  test("requires title and description, accepts optional fields as null", () => {
    const result = OfferDetailsSchema.safeParse({
      title: "Backend role",
      description: "Build APIs",
      requirements: null,
      salary: null,
      contact: null,
    });
    expect(result.success).toBe(true);
  });

  test("coerces missing optional fields to null via .catch", () => {
    const result = OfferDetailsSchema.safeParse({
      title: "Title",
      description: "Description",
      // optional fields omitted entirely
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requirements).toBeNull();
      expect(result.data.salary).toBeNull();
      expect(result.data.contact).toBeNull();
    }
  });

  test("rejects when title or description missing", () => {
    expect(OfferDetailsSchema.safeParse({ description: "x" }).success).toBe(false);
    expect(OfferDetailsSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});

describe("OfferSchema", () => {
  const validOffer = {
    _id: "abcd1234",
    guildId: "guild-1",
    authorId: "user-1",
    status: "PENDING_REVIEW",
    details: {
      title: "Test Offer",
      description: "Test description",
      requirements: null,
      salary: null,
      contact: null,
    },
    reviewMessageId: null,
    reviewChannelId: "channel-review",
    publishedMessageId: null,
    publishedChannelId: null,
    rejectionReason: null,
    changesNote: null,
    moderatorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test("parses a valid offer document", () => {
    expect(OfferSchema.safeParse(validOffer).success).toBe(true);
  });

  test("parses an offer with all approval-side metadata", () => {
    const result = OfferSchema.safeParse({
      ...validOffer,
      status: "APPROVED",
      publishedMessageId: "msg-published",
      publishedChannelId: "channel-approved",
      moderatorId: "mod-1",
    });
    expect(result.success).toBe(true);
  });

  test("parses an offer with rejection metadata", () => {
    const result = OfferSchema.safeParse({
      ...validOffer,
      status: "REJECTED",
      rejectionReason: "Off-topic",
      moderatorId: "mod-1",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an offer missing required identity fields", () => {
    expect(OfferSchema.safeParse({ ...validOffer, _id: undefined }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...validOffer, guildId: undefined }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...validOffer, authorId: undefined }).success).toBe(false);
  });

  test("rejects an offer with an unknown status", () => {
    expect(OfferSchema.safeParse({ ...validOffer, status: "MAYBE" }).success).toBe(false);
  });

  test("coerces createdAt/updatedAt from ISO strings", () => {
    const result = OfferSchema.safeParse({
      ...validOffer,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
    }
  });
});

describe("OfferError", () => {
  test("carries name='OfferError' and the documented code", () => {
    const err = new OfferError("nope", "NOT_FOUND");
    expect(err.name).toBe("OfferError");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("nope");
    expect(err).toBeInstanceOf(Error);
  });

  test("accepts every documented code", () => {
    const codes = [
      "ACTIVE_OFFER_EXISTS",
      "NOT_FOUND",
      "INVALID_STATUS",
      "NO_REVIEW_CHANNEL",
      "DB_ERROR",
    ] as const;
    for (const code of codes) {
      const err = new OfferError("x", code);
      expect(err.code).toBe(code);
    }
  });
});

describe("button customId prefixes", () => {
  // Handlers (handlers/review.ts) split a customId on these literal prefixes
  // to extract the offer id. The values must stay in sync with the buttons
  // built by buildReviewButtons() — these tests pin the contract.
  test("approve prefix is 'offer:approve:'", () => {
    expect(OFFER_APPROVE_PREFIX).toBe("offer:approve:");
  });
  test("reject prefix is 'offer:reject:'", () => {
    expect(OFFER_REJECT_PREFIX).toBe("offer:reject:");
  });
  test("changes prefix is 'offer:changes:'", () => {
    expect(OFFER_CHANGES_PREFIX).toBe("offer:changes:");
  });

  test("prefixes are mutually distinct (no accidental shared prefix)", () => {
    const prefixes = [OFFER_APPROVE_PREFIX, OFFER_REJECT_PREFIX, OFFER_CHANGES_PREFIX];
    for (const a of prefixes) {
      for (const b of prefixes) {
        if (a === b) continue;
        expect(a.startsWith(b)).toBe(false);
        expect(b.startsWith(a)).toBe(false);
      }
    }
  });
});

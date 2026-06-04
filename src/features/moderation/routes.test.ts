/**
 * Pins the customId contracts for moderation routes.
 *
 * These prefixes are baked into buttons and modals that persist in ban DMs and
 * the appeals queue message. A change here silently breaks routing for any such
 * component created before the change — the user clicks and nothing happens. If
 * a prefix legitimately changes, update the route name AND this line together.
 */

import { describe, expect, test } from "bun:test";
import { appealRoutes, modRoutes } from "./routes";

describe("moderation route prefixes — pinned contract", () => {
  test("mod namespace (verify + user-facing appeal flow)", () => {
    expect(modRoutes.verify.prefix).toBe("mod:verify:");
    expect(modRoutes.appeal.prefix).toBe("mod:appeal:");
    expect(modRoutes["appeal-submit"].prefix).toBe("mod:appeal-submit:");
  });

  test("appeal namespace (moderator review flow)", () => {
    expect(appealRoutes.review.prefix).toBe("appeal:review:");
    expect(appealRoutes.approve.prefix).toBe("appeal:approve:");
    expect(appealRoutes.deny.prefix).toBe("appeal:deny:");
    expect(appealRoutes.info.prefix).toBe("appeal:info:");
    expect(appealRoutes["approve-modal"].prefix).toBe("appeal:approve-modal:");
    expect(appealRoutes["deny-modal"].prefix).toBe("appeal:deny-modal:");
    expect(appealRoutes["info-modal"].prefix).toBe("appeal:info-modal:");
  });

  test("ids encode guildId:caseId positionally", () => {
    expect(modRoutes.verify.id({ userId: "1234567890" })).toBe("mod:verify:1234567890");
    expect(modRoutes.appeal.id({ guildId: "111", caseId: 42 })).toBe("mod:appeal:111:42");
    expect(appealRoutes.review.id({ guildId: "111", caseId: 42 })).toBe("appeal:review:111:42");
  });

  test("appeal-submit prefix does NOT nest under the appeal button prefix", () => {
    // The old startsWith router could mis-route `mod:appeal-submit:` to the
    // `mod:appeal:` handler. The trailing-colon prefixes don't nest.
    expect(modRoutes["appeal-submit"].prefix.startsWith(modRoutes.appeal.prefix)).toBe(false);
    expect(
      modRoutes.appeal
        .id({ guildId: "111", caseId: 1 })
        .startsWith(modRoutes["appeal-submit"].prefix),
    ).toBe(false);
  });
});

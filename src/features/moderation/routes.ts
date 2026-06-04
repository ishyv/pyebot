/**
 * Component routes for moderation. Two namespaces preserve the original
 * customId prefixes so buttons/modals persisted in DMs and queue messages keep
 * routing after this migration:
 *
 *   "mod" namespace    → verification gate + the user-facing ban-appeal flow.
 *   "appeal" namespace → the moderator-facing appeal review/decision flow.
 *
 * `mod:appeal:` (button) and `mod:appeal-submit:` (modal) no longer risk the old
 * startsWith collision: the segment decoder resolves on the full `ns:route`, and
 * the trailing-colon prefixes (`mod:appeal:` vs `mod:appeal-submit:`) don't nest.
 */

import { defineRoutes, int, route, snowflake } from "@/framework";

export const modRoutes = defineRoutes("mod", {
  // Verification gate button — carries the user who may click it.
  verify: { userId: snowflake },
  // "Appeal Ban" button in the ban DM, and the modal it opens.
  appeal: { guildId: snowflake, caseId: int },
  "appeal-submit": route({ guildId: snowflake, caseId: int }, "modal"),
});

export const appealRoutes = defineRoutes("appeal", {
  // Review button on the queue message → ephemeral mod panel.
  review: { guildId: snowflake, caseId: int },
  // Decision buttons on the review panel → their respective modals.
  approve: { guildId: snowflake, caseId: int },
  deny: { guildId: snowflake, caseId: int },
  info: { guildId: snowflake, caseId: int },
  "approve-modal": route({ guildId: snowflake, caseId: int }, "modal"),
  "deny-modal": route({ guildId: snowflake, caseId: int }, "modal"),
  "info-modal": route({ guildId: snowflake, caseId: int }, "modal"),
});

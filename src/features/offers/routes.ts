/**
 * Component routes for offers — review buttons and modals. Route names keep the
 * original second segment (incl. hyphens), so the prefixes are unchanged:
 * `offer:approve:`, `offer:reject-modal:`, etc. Offer ids are hex tokens (no
 * colons), so `str` is the right codec.
 */

import { defineRoutes, route, str } from "@/framework";

export const routes = defineRoutes("offer", {
  // Moderator review buttons — each carries the offer id.
  approve: { offer: str },
  reject: { offer: str },
  changes: { offer: str },
  // Modals opened from the reject/changes buttons — also carry the offer id.
  "reject-modal": route({ offer: str }, "modal"),
  "changes-modal": route({ offer: str }, "modal"),
  // The /offer create modal — no args; the author is the submitter.
  "create-modal": route({}, "modal"),
});

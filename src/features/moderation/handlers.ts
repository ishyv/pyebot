/**
 * Moderation feature component handlers — a flat registration list. Each route's
 * `args` (guildId/caseId, or userId for verify) is decoded and typed from the
 * schema (see ./routes.ts); a stale or garbled customId is skipped before the
 * handler runs.
 *
 *   mod:verify:         → verification gate button (assigns verified role)
 *   mod:appeal:         → appeal button in ban DM (shows modal)
 *   mod:appeal-submit:  → appeal modal submit (creates record + thread)
 *   appeal:review:      → review button on queue message (ephemeral panel)
 *   appeal:approve/deny/info:        → review-panel buttons (show modals)
 *   appeal:approve/deny/info-modal:  → modal submits (decide + DM user)
 */
import { defineHandlers, routeHandlers } from "@/framework";
import { handleAppealButton, handleAppealSubmit } from "./handlers/appealButton";
import {
  handleAppealApproveButton,
  handleAppealApproveSubmit,
  handleAppealDenyButton,
  handleAppealDenySubmit,
  handleAppealInfoButton,
  handleAppealInfoSubmit,
  handleAppealReview,
} from "./handlers/appealReview";
import { handleVerifyButton } from "./handlers/verifyButton";
import { appealRoutes, modRoutes } from "./routes";

export default defineHandlers([
  ...routeHandlers(modRoutes, {
    verify: (interaction, args) => handleVerifyButton(interaction, args.userId),
    appeal: (interaction, args) => handleAppealButton(interaction, args),
    "appeal-submit": (interaction, args) => handleAppealSubmit(interaction, args),
  }),
  ...routeHandlers(appealRoutes, {
    review: (interaction, args) => handleAppealReview(interaction, args),
    approve: (interaction, args) => handleAppealApproveButton(interaction, args),
    deny: (interaction, args) => handleAppealDenyButton(interaction, args),
    info: (interaction, args) => handleAppealInfoButton(interaction, args),
    "approve-modal": (interaction, args) => handleAppealApproveSubmit(interaction, args),
    "deny-modal": (interaction, args) => handleAppealDenySubmit(interaction, args),
    "info-modal": (interaction, args) => handleAppealInfoSubmit(interaction, args),
  }),
]);

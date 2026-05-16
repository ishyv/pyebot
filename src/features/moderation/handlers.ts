/**
 * Moderation feature component handlers.
 *
 * Routes button and modal interactions for the appeals workflow:
 *   - "mod:appeal:"         → appeal button in ban DM (shows modal)
 *   - "mod:appeal-submit:"  → appeal modal submit (creates record + thread)
 *   - "appeal:review:"      → review button on queue message (ephemeral panel)
 *   - "appeal:approve:"     → approve button on review panel (shows modal)
 *   - "appeal:deny:"        → deny button on review panel (shows modal)
 *   - "appeal:info:"        → request-info button on review panel (shows modal)
 *   - "appeal:approve-modal:" → approve modal submit (writes PARDON, DMs user)
 *   - "appeal:deny-modal:"    → deny modal submit (DMs user)
 *   - "appeal:info-modal:"    → info-request modal submit (DMs user, posts in thread)
 */
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { Handle } from "@/framework";
import type { Ctx } from "@/framework/types";
import {
  APPEAL_BUTTON_PREFIX,
  APPEAL_SUBMIT_PREFIX,
  handleAppealButton,
  handleAppealSubmit,
} from "./handlers/appealButton";
import {
  APPEAL_APPROVE_MODAL_PREFIX,
  APPEAL_APPROVE_PREFIX,
  APPEAL_DENY_MODAL_PREFIX,
  APPEAL_DENY_PREFIX,
  APPEAL_INFO_MODAL_PREFIX,
  APPEAL_INFO_PREFIX,
  APPEAL_REVIEW_PREFIX,
  handleAppealApproveButton,
  handleAppealApproveSubmit,
  handleAppealDenyButton,
  handleAppealDenySubmit,
  handleAppealInfoButton,
  handleAppealInfoSubmit,
  handleAppealReview,
} from "./handlers/appealReview";

export default class ModerationHandlers {
  @Handle(APPEAL_BUTTON_PREFIX)
  async onAppealButton(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealButton(interaction);
  }

  @Handle(APPEAL_SUBMIT_PREFIX)
  async onAppealSubmit(interaction: ModalSubmitInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealSubmit(interaction);
  }

  @Handle(APPEAL_REVIEW_PREFIX)
  async onAppealReview(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealReview(interaction);
  }

  @Handle(APPEAL_APPROVE_PREFIX)
  async onAppealApproveButton(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealApproveButton(interaction);
  }

  @Handle(APPEAL_DENY_PREFIX)
  async onAppealDenyButton(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealDenyButton(interaction);
  }

  @Handle(APPEAL_INFO_PREFIX)
  async onAppealInfoButton(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealInfoButton(interaction);
  }

  @Handle(APPEAL_APPROVE_MODAL_PREFIX)
  async onAppealApproveSubmit(interaction: ModalSubmitInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealApproveSubmit(interaction);
  }

  @Handle(APPEAL_DENY_MODAL_PREFIX)
  async onAppealDenySubmit(interaction: ModalSubmitInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealDenySubmit(interaction);
  }

  @Handle(APPEAL_INFO_MODAL_PREFIX)
  async onAppealInfoSubmit(interaction: ModalSubmitInteraction, _ctx: Ctx): Promise<void> {
    await handleAppealInfoSubmit(interaction);
  }
}

/**
 * Offer component router.
 *
 * Each @Handle method covers one prefix; the framework binds these at boot
 * so the ComponentRouter dispatches button and modal interactions here.
 *
 * Flow for review actions:
 *   approve button  → deferReply → approveOffer
 *   reject button   → showModal (no defer before showModal)
 *   reject modal    → deferReply → rejectOffer
 *   changes button  → showModal
 *   changes modal   → deferReply → requestChanges
 *
 * Flow for submission:
 *   /offer create   → showModal (handled in commands/offer.ts)
 *   create modal    → deferReply → createOffer
 */

import {
  type ButtonInteraction,
  MessageFlags,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { Handle } from "@/framework";
import type { Ctx } from "@/framework/types";
import {
  approveOffer,
  buildChangesModal,
  buildCreateModal,
  buildRejectModal,
  createOffer,
  OFFER_APPROVE_PREFIX,
  OFFER_CHANGES_MODAL_PREFIX,
  OFFER_CHANGES_PREFIX,
  OFFER_CREATE_MODAL_ID,
  OFFER_REJECT_MODAL_PREFIX,
  OFFER_REJECT_PREFIX,
  type OfferError,
  rejectOffer,
  requestChanges,
} from "./service";

function isModerator(interaction: ButtonInteraction): boolean {
  const { member } = interaction;
  return !!(
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

export default class OffersHandlers {
  @Handle(OFFER_APPROVE_PREFIX)
  async onApprove(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    if (!isModerator(interaction)) {
      await interaction.reply({
        content: "You need Manage Server permission to review offers.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const offerId = interaction.customId.slice(OFFER_APPROVE_PREFIX.length);
    const result = await approveOffer(guild, offerId, interaction.user.id);
    await interaction.editReply({
      content: result.isErr() ? `Failed to approve: ${result.error.message}` : "Offer approved.",
    });
  }

  @Handle(OFFER_REJECT_PREFIX)
  async onReject(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    if (!isModerator(interaction)) {
      await interaction.reply({
        content: "You need Manage Server permission to review offers.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const offerId = interaction.customId.slice(OFFER_REJECT_PREFIX.length);
    // showModal must not be preceded by deferUpdate/deferReply
    await interaction.showModal(buildRejectModal(offerId));
  }

  @Handle(OFFER_REJECT_MODAL_PREFIX)
  async onRejectModal(interaction: ModalSubmitInteraction, _ctx: Ctx): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const offerId = interaction.customId.slice(OFFER_REJECT_MODAL_PREFIX.length);
    const reason = interaction.fields.getTextInputValue("reason");
    const result = await rejectOffer(guild, offerId, interaction.user.id, reason);
    await interaction.editReply({
      content: result.isErr() ? `Failed to reject: ${result.error.message}` : "Offer rejected.",
    });
  }

  @Handle(OFFER_CHANGES_PREFIX)
  async onChanges(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    if (!isModerator(interaction)) {
      await interaction.reply({
        content: "You need Manage Server permission to review offers.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const offerId = interaction.customId.slice(OFFER_CHANGES_PREFIX.length);
    await interaction.showModal(buildChangesModal(offerId));
  }

  @Handle(OFFER_CHANGES_MODAL_PREFIX)
  async onChangesModal(interaction: ModalSubmitInteraction, _ctx: Ctx): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const offerId = interaction.customId.slice(OFFER_CHANGES_MODAL_PREFIX.length);
    const note = interaction.fields.getTextInputValue("note");
    const result = await requestChanges(guild, offerId, interaction.user.id, note);
    await interaction.editReply({
      content: result.isErr()
        ? `Failed to request changes: ${result.error.message}`
        : "Changes requested.",
    });
  }

  @Handle(OFFER_CREATE_MODAL_ID)
  async onCreateModal(interaction: ModalSubmitInteraction, _ctx: Ctx): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "Offers can only be submitted in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const details = {
      title: interaction.fields.getTextInputValue("title"),
      description: interaction.fields.getTextInputValue("description"),
      requirements: interaction.fields.getTextInputValue("requirements") || null,
      salary: interaction.fields.getTextInputValue("salary") || null,
      contact: interaction.fields.getTextInputValue("contact") || null,
    };

    const result = await createOffer(
      guild,
      interaction.user.id,
      interaction.user.username,
      details,
    );

    if (result.isErr()) {
      const err = result.error as OfferError;
      const msg =
        err.code === "ACTIVE_OFFER_EXISTS"
          ? "You already have an active offer. Withdraw it first."
          : err.code === "NO_REVIEW_CHANNEL"
            ? "The offers review channel is not configured. Contact an administrator."
            : err.code === "FORBIDDEN"
              ? "You don't have permission to submit offers on this server."
              : `Failed to submit offer: ${err.message}`;
      await interaction.editReply({ content: msg });
      return;
    }

    // Offer created — also build the modal again to pass the guild check for
    // the buildCreateModal export (used to re-show if needed). Here we just
    // confirm to the user.
    const offer = result.unwrap();
    await interaction.editReply({
      content: `✅ Your offer **${offer.details.title}** has been submitted for review. (ID: \`${offer._id}\`)`,
    });
  }
}

// Re-export for the /offer create command so it can show the modal.
export { buildCreateModal };

/**
 * Offer review button handlers.
 *
 * Handles `offer:approve:{id}`, `offer:reject:{id}`, `offer:changes:{id}` buttons.
 * Approve/reject/changes require the moderator to have ManageGuild permission.
 * Reject and request-changes prompt for a reason via follow-up ephemeral reply.
 */

import {
  type ButtonInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import {
  OFFER_APPROVE_PREFIX,
  OFFER_REJECT_PREFIX,
  OFFER_CHANGES_PREFIX,
  approveOffer,
  rejectOffer,
  requestChanges,
} from "@/features/offers/service";

export function isOfferReviewButton(customId: string): boolean {
  return (
    customId.startsWith(OFFER_APPROVE_PREFIX) ||
    customId.startsWith(OFFER_REJECT_PREFIX) ||
    customId.startsWith(OFFER_CHANGES_PREFIX)
  );
}

function requireModerator(interaction: ButtonInteraction): boolean {
  const member = interaction.member;
  return !!(
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

export async function handleOfferReview(interaction: ButtonInteraction): Promise<void> {
  const cid = interaction.customId;

  if (cid.startsWith(OFFER_APPROVE_PREFIX)) {
    await handleApprove(interaction, cid.slice(OFFER_APPROVE_PREFIX.length));
  } else if (cid.startsWith(OFFER_REJECT_PREFIX)) {
    await handleRejectOrChanges(interaction, cid.slice(OFFER_REJECT_PREFIX.length), "reject");
  } else if (cid.startsWith(OFFER_CHANGES_PREFIX)) {
    await handleRejectOrChanges(interaction, cid.slice(OFFER_CHANGES_PREFIX.length), "changes");
  }
}

async function handleApprove(interaction: ButtonInteraction, offerId: string): Promise<void> {
  if (!requireModerator(interaction)) {
    await interaction.reply({ content: "You need ManageGuild to review offers.", ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Guild not found.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const result = await approveOffer(guild, offerId, interaction.user.id);

  if (result.isErr()) {
    await interaction.editReply({ content: `Failed to approve: ${result.error.message}` });
    return;
  }

  await interaction.editReply({ content: `Offer approved.` });
}

async function handleRejectOrChanges(
  interaction: ButtonInteraction,
  offerId: string,
  type: "reject" | "changes",
): Promise<void> {
  if (!requireModerator(interaction)) {
    await interaction.reply({ content: "You need ManageGuild to review offers.", ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Guild not found.", ephemeral: true });
    return;
  }

  // Show a modal to collect the reason/note
  const modal = new ModalBuilder()
    .setCustomId(
      type === "reject" ? `offer_reject_modal:${offerId}` : `offer_changes_modal:${offerId}`,
    )
    .setTitle(type === "reject" ? "Reject Offer" : "Request Changes")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel(type === "reject" ? "Rejection reason" : "Changes needed")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(500),
      ),
    );

  await interaction.showModal(modal);

  // Wait for modal submission
  try {
    const modalInteraction = await interaction.awaitModalSubmit({
      filter: (i) => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000,
    });

    const reason = modalInteraction.fields.getTextInputValue("reason");

    const result =
      type === "reject"
        ? await rejectOffer(guild, offerId, interaction.user.id, reason)
        : await requestChanges(guild, offerId, interaction.user.id, reason);

    if (result.isErr()) {
      await modalInteraction.reply({
        content: `Failed: ${result.error.message}`,
        ephemeral: true,
      });
      return;
    }

    await modalInteraction.reply({
      content: type === "reject" ? "Offer rejected." : "Changes requested.",
      ephemeral: true,
    });
  } catch {
    // Modal timed out — user didn't submit
  }
}

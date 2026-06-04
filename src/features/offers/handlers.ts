/**
 * Offer component handlers — a flat registration list. Each route's `args` is
 * decoded and typed from the schema (see ./routes.ts).
 *
 * Flow:
 *   approve button  → deferReply → approveOffer
 *   reject button   → showModal (no defer before showModal)
 *   reject modal    → deferReply → rejectOffer
 *   changes button  → showModal
 *   changes modal   → deferReply → requestChanges
 *   create modal    → deferReply → createOffer  (modal shown from commands/offer.ts)
 */

import { type ButtonInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineHandlers, routeHandlers } from "@/framework";
import { routes } from "./routes";
import {
  approveOffer,
  buildChangesModal,
  buildCreateModal,
  buildRejectModal,
  createOffer,
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

const NOT_MOD = {
  content: "You need Manage Server permission to review offers.",
  flags: MessageFlags.Ephemeral,
} as const;

export default defineHandlers([
  ...routeHandlers(routes, {
    approve: async (interaction, args) => {
      if (!isModerator(interaction)) {
        await interaction.reply(NOT_MOD);
        return;
      }
      const guild = interaction.guild;
      if (!guild) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await approveOffer(guild, args.offer, interaction.user.id);
      await interaction.editReply({
        content: result.isErr() ? `Failed to approve: ${result.error.message}` : "Offer approved.",
      });
    },

    reject: async (interaction, args) => {
      if (!isModerator(interaction)) {
        await interaction.reply(NOT_MOD);
        return;
      }
      // showModal must not be preceded by deferUpdate/deferReply.
      await interaction.showModal(buildRejectModal(args.offer));
    },

    "reject-modal": async (interaction, args) => {
      const guild = interaction.guild;
      if (!guild) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const reason = interaction.fields.getTextInputValue("reason");
      const result = await rejectOffer(guild, args.offer, interaction.user.id, reason);
      await interaction.editReply({
        content: result.isErr() ? `Failed to reject: ${result.error.message}` : "Offer rejected.",
      });
    },

    changes: async (interaction, args) => {
      if (!isModerator(interaction)) {
        await interaction.reply(NOT_MOD);
        return;
      }
      await interaction.showModal(buildChangesModal(args.offer));
    },

    "changes-modal": async (interaction, args) => {
      const guild = interaction.guild;
      if (!guild) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const note = interaction.fields.getTextInputValue("note");
      const result = await requestChanges(guild, args.offer, interaction.user.id, note);
      await interaction.editReply({
        content: result.isErr()
          ? `Failed to request changes: ${result.error.message}`
          : "Changes requested.",
      });
    },

    "create-modal": async (interaction) => {
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

      const offer = result.unwrap();
      await interaction.editReply({
        content: `✅ Your offer **${offer.details.title}** has been submitted for review. (ID: \`${offer._id}\`)`,
      });
    },
  }),
]);

// Re-export for the /offer create command so it can show the modal.
export { buildCreateModal };

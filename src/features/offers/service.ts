/**
 * Offers service.
 *
 * Flow: author creates offer → posts to review channel → moderator approves/rejects/requests changes.
 * If approved, posts to approved-offers channel and DMs author.
 *
 * State: MongoDB `offers` collection. One active offer per author per guild.
 * Channels: `guild.channels.core.offersReview` and `guild.channels.core.approvedOffers`.
 */

import { randomBytes } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Guild as DjsGuild,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { createLogger } from "@/core/logger";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { getGuild } from "@/db/repositories/guilds";
import { findActiveOfferByAuthor, getOffer, saveOffer } from "@/db/repositories/offers";
import {
  type Offer,
  type OfferDetails,
  OfferDetailsSchema,
  OfferSchema,
  type OfferStatus,
  OfferStatusSchema,
} from "@/db/schemas/offer";
import type { AccentKey } from "@/ui/theme";
import { container, separator, text, v2Message } from "@/ui/v2";

const log = createLogger("offers");

export type { Offer, OfferDetails, OfferStatus };
export { OfferDetailsSchema, OfferSchema, OfferStatusSchema };

const ACTIVE_STATUSES: OfferStatus[] = ["PENDING_REVIEW", "CHANGES_REQUESTED"];

// ─── customId constants ───────────────────────────────────────────────────────
// Button prefixes carry the offerId as a suffix: `offer:approve:{offerId}`
export const OFFER_APPROVE_PREFIX = "offer:approve:";
export const OFFER_REJECT_PREFIX = "offer:reject:";
export const OFFER_CHANGES_PREFIX = "offer:changes:";
// Modal prefixes follow the same suffix convention for reject/changes.
export const OFFER_REJECT_MODAL_PREFIX = "offer:reject-modal:";
export const OFFER_CHANGES_MODAL_PREFIX = "offer:changes-modal:";
// Fixed id — no offerId needed; the author is read from the modal interaction.
export const OFFER_CREATE_MODAL_ID = "offer:create-modal";

/** Five-field modal shown to the user when they run /offer create. */
export function buildCreateModal(): ModalBuilder {
  const input = (
    id: string,
    label: string,
    style: TextInputStyle,
    required: boolean,
    maxLength: number,
  ) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setRequired(required)
        .setMaxLength(maxLength),
    );

  return new ModalBuilder()
    .setCustomId(OFFER_CREATE_MODAL_ID)
    .setTitle("Submit an Offer")
    .addComponents(
      input("title", "Title", TextInputStyle.Short, true, 100),
      input("description", "Description", TextInputStyle.Paragraph, true, 1000),
      input("requirements", "Requirements (optional)", TextInputStyle.Paragraph, false, 500),
      input("salary", "Salary / Compensation (optional)", TextInputStyle.Short, false, 200),
      input("contact", "Contact info (optional)", TextInputStyle.Short, false, 200),
    );
}

/** Single-field modal for a moderator to enter a rejection reason. */
export function buildRejectModal(offerId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${OFFER_REJECT_MODAL_PREFIX}${offerId}`)
    .setTitle("Reject Offer")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Rejection reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(500),
      ),
    );
}

/** Single-field modal for a moderator to describe needed changes. */
export function buildChangesModal(offerId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${OFFER_CHANGES_MODAL_PREFIX}${offerId}`)
    .setTitle("Request Changes")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("note")
          .setLabel("Changes needed")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(500),
      ),
    );
}

function buildReviewButtons(offerId: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${OFFER_APPROVE_PREFIX}${offerId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${OFFER_REJECT_PREFIX}${offerId}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${OFFER_CHANGES_PREFIX}${offerId}`)
      .setLabel("Request Changes")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

function buildOfferContainer(offer: Offer, status: OfferStatus, authorUsername?: string) {
  const statusAccent: Record<OfferStatus, AccentKey> = {
    PENDING_REVIEW: "warn",
    APPROVED: "ok",
    REJECTED: "danger",
    CHANGES_REQUESTED: "warn",
    WITHDRAWN: "mute",
  };

  const extraLines = [
    offer.details.requirements ? `**Requirements:** ${offer.details.requirements}` : null,
    offer.details.salary ? `**Salary:** ${offer.details.salary}` : null,
    offer.details.contact ? `**Contact:** ${offer.details.contact}` : null,
    `**Author:** <@${offer.authorId}>`,
    offer.rejectionReason ? `**Rejection Reason:** ${offer.rejectionReason}` : null,
    offer.changesNote ? `**Changes Requested:** ${offer.changesNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return container(
    statusAccent[status],
    text(
      `## ${offer.details.title}${authorUsername ? ` — ${authorUsername}` : ""}\n${offer.details.description}`,
    ),
    separator("sm"),
    text(extraLines),
    separator("sm"),
    text(`-# Offer ID: ${offer._id} | Status: ${status}`),
  );
}

// ─── Channel helpers ──────────────────────────────────────────────────────────

async function getChannels(guildId: string): Promise<{
  reviewChannelId: string | null;
  approvedChannelId: string | null;
}> {
  const res = await getGuild(guildId);
  if (res.isErr()) return { reviewChannelId: null, approvedChannelId: null };
  const guild = res.unwrap();
  if (!guild) return { reviewChannelId: null, approvedChannelId: null };
  const core = guild.channels.core;
  return {
    reviewChannelId: core.offersReview?.channelId ?? null,
    approvedChannelId: core.approvedOffers?.channelId ?? null,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export class OfferError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ACTIVE_OFFER_EXISTS"
      | "NOT_FOUND"
      | "INVALID_STATUS"
      | "NO_REVIEW_CHANNEL"
      | "FORBIDDEN"
      | "DB_ERROR",
  ) {
    super(message);
    this.name = "OfferError";
  }
}

export async function findActiveByAuthor(
  guildId: string,
  authorId: string,
): Promise<Result<Offer | null>> {
  return findActiveOfferByAuthor(guildId, authorId, ACTIVE_STATUSES);
}

export async function createOffer(
  guild: DjsGuild,
  authorId: string,
  authorUsername: string,
  details: OfferDetails,
): Promise<Result<Offer>> {
  const existingRes = await findActiveByAuthor(guild.id, authorId);
  if (existingRes.isErr()) return ErrResult(existingRes.error);
  if (existingRes.unwrap()) {
    return ErrResult(new OfferError("You already have an active offer.", "ACTIVE_OFFER_EXISTS"));
  }

  // Role gate — skip when allowedRoleIds is empty (open submission).
  const guildCfgRes = await getGuild(guild.id);
  const allowedRoles = guildCfgRes.isOk()
    ? (guildCfgRes.unwrap()?.offersConfig?.allowedRoleIds ?? [])
    : [];
  if (allowedRoles.length > 0) {
    const member = await guild.members.fetch(authorId).catch(() => null);
    if (!member || !allowedRoles.some((r) => member.roles.cache.has(r))) {
      return ErrResult(new OfferError("You don't have permission to submit offers.", "FORBIDDEN"));
    }
  }

  const { reviewChannelId } = await getChannels(guild.id);
  if (!reviewChannelId) {
    return ErrResult(new OfferError("No review channel configured.", "NO_REVIEW_CHANNEL"));
  }

  const id = randomBytes(5).toString("hex");
  const offer: Offer = {
    _id: id,
    guildId: guild.id,
    authorId,
    status: "PENDING_REVIEW",
    details,
    reviewMessageId: null,
    reviewChannelId,
    publishedMessageId: null,
    publishedChannelId: null,
    rejectionReason: null,
    changesNote: null,
    moderatorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Post to review channel first
  let reviewMessageId: string | null = null;
  try {
    const reviewChannel = await guild.channels.fetch(reviewChannelId);
    if (reviewChannel?.isTextBased() && "send" in reviewChannel) {
      // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not in discord.js MessageCreateOptions types.
      const msg = await (reviewChannel as any).send({
        ...v2Message(
          buildOfferContainer(offer, "PENDING_REVIEW", authorUsername),
          buildReviewButtons(id),
        ),
      });
      reviewMessageId = msg.id;
    }
  } catch (err) {
    log.error("Failed to post to review channel", err);
  }

  offer.reviewMessageId = reviewMessageId;
  const saveRes = await saveOffer(offer);
  if (saveRes.isErr()) {
    // Clean up review message if save failed
    if (reviewMessageId && reviewChannelId) {
      try {
        const ch = await guild.channels.fetch(reviewChannelId);
        if (ch?.isTextBased() && "messages" in ch) {
          await (ch as { messages: { delete(id: string): Promise<unknown> } }).messages
            .delete(reviewMessageId)
            .catch(() => null);
        }
      } catch {
        /* best-effort */
      }
    }
    return ErrResult(saveRes.error);
  }

  return OkResult(offer);
}

export async function approveOffer(
  guild: DjsGuild,
  offerId: string,
  moderatorId: string,
): Promise<Result<Offer>> {
  const res = await getOffer(offerId);
  if (res.isErr()) return ErrResult(res.error);

  const offer = res.unwrap();
  if (!offer) return ErrResult(new OfferError("Offer not found.", "NOT_FOUND"));
  if (!ACTIVE_STATUSES.includes(offer.status)) {
    return ErrResult(new OfferError("Offer is not in a reviewable state.", "INVALID_STATUS"));
  }

  const { approvedChannelId } = await getChannels(guild.id);

  // Publish to approved channel
  let publishedMessageId: string | null = null;
  let publishedChannelId: string | null = null;
  if (approvedChannelId) {
    try {
      const approvedChannel = await guild.channels.fetch(approvedChannelId);
      if (approvedChannel?.isTextBased() && "send" in approvedChannel) {
        // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not in discord.js MessageCreateOptions types.
        const msg = await (approvedChannel as any).send({
          ...v2Message(buildOfferContainer(offer, "APPROVED")),
          allowedMentions: { users: [offer.authorId] },
        });
        publishedMessageId = msg.id;
        publishedChannelId = approvedChannelId;
      }
    } catch (err) {
      log.error("Failed to publish approved offer", err);
    }
  }

  // Update review message
  await updateReviewMessage(guild, offer, "APPROVED", null, true);

  const updated: Offer = {
    ...offer,
    status: "APPROVED",
    moderatorId,
    publishedMessageId,
    publishedChannelId,
    updatedAt: new Date(),
  };
  await saveOffer(updated);

  // DM author
  try {
    const user = await guild.client.users.fetch(offer.authorId);
    await user
      .send({ content: `✅ Your offer **${offer.details.title}** has been approved!` })
      .catch(() => null);
  } catch {
    /* best-effort */
  }

  return OkResult(updated);
}

export async function rejectOffer(
  guild: DjsGuild,
  offerId: string,
  moderatorId: string,
  reason: string,
): Promise<Result<Offer>> {
  const res = await getOffer(offerId);
  if (res.isErr()) return ErrResult(res.error);

  const offer = res.unwrap();
  if (!offer) return ErrResult(new OfferError("Offer not found.", "NOT_FOUND"));
  if (!ACTIVE_STATUSES.includes(offer.status)) {
    return ErrResult(new OfferError("Offer is not in a reviewable state.", "INVALID_STATUS"));
  }

  await updateReviewMessage(guild, offer, "REJECTED", reason, true);

  const updated: Offer = {
    ...offer,
    status: "REJECTED",
    moderatorId,
    rejectionReason: reason,
    updatedAt: new Date(),
  };
  await saveOffer(updated);

  try {
    const user = await guild.client.users.fetch(offer.authorId);
    await user
      .send({
        content: `❌ Your offer **${offer.details.title}** was rejected.\n**Reason:** ${reason}`,
      })
      .catch(() => null);
  } catch {
    /* best-effort */
  }

  return OkResult(updated);
}

export async function requestChanges(
  guild: DjsGuild,
  offerId: string,
  moderatorId: string,
  note: string,
): Promise<Result<Offer>> {
  const res = await getOffer(offerId);
  if (res.isErr()) return ErrResult(res.error);

  const offer = res.unwrap();
  if (!offer) return ErrResult(new OfferError("Offer not found.", "NOT_FOUND"));
  if (!ACTIVE_STATUSES.includes(offer.status)) {
    return ErrResult(new OfferError("Offer is not in a reviewable state.", "INVALID_STATUS"));
  }

  await updateReviewMessage(guild, offer, "CHANGES_REQUESTED", note, false);

  const updated: Offer = {
    ...offer,
    status: "CHANGES_REQUESTED",
    moderatorId,
    changesNote: note,
    updatedAt: new Date(),
  };
  await saveOffer(updated);

  try {
    const user = await guild.client.users.fetch(offer.authorId);
    await user
      .send({
        content: `🔄 Changes were requested for your offer **${offer.details.title}**.\n**Note:** ${note}`,
      })
      .catch(() => null);
  } catch {
    /* best-effort */
  }

  return OkResult(updated);
}

export async function withdrawOffer(guild: DjsGuild, authorId: string): Promise<Result<boolean>> {
  const res = await findActiveByAuthor(guild.id, authorId);
  if (res.isErr()) return ErrResult(res.error);

  const offer = res.unwrap();
  if (!offer) return OkResult(false);

  const updated: Offer = { ...offer, status: "WITHDRAWN", updatedAt: new Date() };
  await saveOffer(updated);
  // Mark the review card as WITHDRAWN and disable its buttons so moderators
  // don't act on a submission that no longer exists.
  await updateReviewMessage(guild, offer, "WITHDRAWN", null, true);
  return OkResult(true);
}

async function updateReviewMessage(
  guild: DjsGuild,
  offer: Offer,
  status: OfferStatus,
  note: string | null,
  disabled: boolean,
): Promise<void> {
  if (!offer.reviewChannelId || !offer.reviewMessageId) return;

  try {
    const ch = await guild.channels.fetch(offer.reviewChannelId);
    if (!ch?.isTextBased() || !("messages" in ch)) return;

    await (ch as { messages: { edit(id: string, opts: unknown): Promise<unknown> } }).messages.edit(
      offer.reviewMessageId,
      {
        ...v2Message(
          buildOfferContainer(
            { ...offer, status, rejectionReason: note, changesNote: note },
            status,
          ),
          buildReviewButtons(offer._id, disabled),
        ),
      },
    );
  } catch (err) {
    log.error("Failed to update review message", err);
  }
}

export { buildReviewButtons };

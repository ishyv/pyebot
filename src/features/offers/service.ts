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
import { z } from "zod";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Colors,
  type Guild as DjsGuild,
} from "discord.js";
import { MongoStore } from "@/db/store";
import { getGuild } from "@/db/repositories/guilds";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { createLogger } from "@/core/logger";

const log = createLogger("offers");

// ─── Schema ───────────────────────────────────────────────────────────────────

export const OfferStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "WITHDRAWN",
]);

export type OfferStatus = z.infer<typeof OfferStatusSchema>;

export const OfferDetailsSchema = z.object({
  title: z.string(),
  description: z.string(),
  requirements: z.string().nullable().catch(null),
  salary: z.string().nullable().catch(null),
  contact: z.string().nullable().catch(null),
});

export type OfferDetails = z.infer<typeof OfferDetailsSchema>;

export const OfferSchema = z.object({
  _id: z.string(),
  guildId: z.string(),
  authorId: z.string(),
  status: OfferStatusSchema,
  details: OfferDetailsSchema,
  reviewMessageId: z.string().nullable().catch(null),
  reviewChannelId: z.string().nullable().catch(null),
  publishedMessageId: z.string().nullable().catch(null),
  publishedChannelId: z.string().nullable().catch(null),
  rejectionReason: z.string().nullable().catch(null),
  changesNote: z.string().nullable().catch(null),
  moderatorId: z.string().nullable().catch(null),
  createdAt: z.coerce.date().optional().catch(undefined),
  updatedAt: z.coerce.date().optional().catch(undefined),
});

export type Offer = z.infer<typeof OfferSchema>;

const ACTIVE_STATUSES: OfferStatus[] = ["PENDING_REVIEW", "CHANGES_REQUESTED"];

const offerStore = new MongoStore("offers", OfferSchema);

// ─── Button customId constants ────────────────────────────────────────────────

export const OFFER_APPROVE_PREFIX = "offer:approve:";
export const OFFER_REJECT_PREFIX = "offer:reject:";
export const OFFER_CHANGES_PREFIX = "offer:changes:";

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

function buildOfferEmbed(offer: Offer, status: OfferStatus): EmbedBuilder {
  const statusColor: Record<OfferStatus, number> = {
    PENDING_REVIEW: Colors.Yellow,
    APPROVED: Colors.Green,
    REJECTED: Colors.Red,
    CHANGES_REQUESTED: Colors.Orange,
    WITHDRAWN: Colors.Grey,
  };

  const embed = new EmbedBuilder()
    .setColor(statusColor[status])
    .setTitle(offer.details.title)
    .setDescription(offer.details.description)
    .setFooter({ text: `Offer ID: ${offer._id} | Status: ${status}` })
    .setTimestamp();

  if (offer.details.requirements) embed.addFields({ name: "Requirements", value: offer.details.requirements });
  if (offer.details.salary) embed.addFields({ name: "Salary", value: offer.details.salary });
  if (offer.details.contact) embed.addFields({ name: "Contact", value: offer.details.contact });
  embed.addFields({ name: "Author", value: `<@${offer.authorId}>`, inline: true });

  if (offer.rejectionReason) embed.addFields({ name: "Rejection Reason", value: offer.rejectionReason });
  if (offer.changesNote) embed.addFields({ name: "Changes Requested", value: offer.changesNote });

  return embed;
}

// ─── Channel helpers ──────────────────────────────────────────────────────────

async function getChannels(guildId: string): Promise<{
  reviewChannelId: string | null;
  approvedChannelId: string | null;
}> {
  const res = await getGuild(guildId);
  if (res.isErr() || !res.unwrap()) return { reviewChannelId: null, approvedChannelId: null };

  const core = res.unwrap()!.channels.core;
  return {
    reviewChannelId: core["offersReview"]?.channelId ?? null,
    approvedChannelId: core["approvedOffers"]?.channelId ?? null,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export class OfferError extends Error {
  constructor(
    message: string,
    public readonly code: "ACTIVE_OFFER_EXISTS" | "NOT_FOUND" | "INVALID_STATUS" | "NO_REVIEW_CHANNEL" | "DB_ERROR",
  ) {
    super(message);
    this.name = "OfferError";
  }
}

async function findActiveByAuthor(guildId: string, authorId: string): Promise<Result<Offer | null>> {
  try {
    const col = await offerStore.collection();
    const doc = await col.findOne({ guildId, authorId, status: { $in: ACTIVE_STATUSES } } as never);
    return OkResult(doc ? OfferSchema.parse(doc) : null);
  } catch (err) {
    return ErrResult(err instanceof Error ? err : new Error(String(err)));
  }
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
      const embed = buildOfferEmbed(offer, "PENDING_REVIEW");
      embed.setAuthor({ name: authorUsername });
      const msg = await reviewChannel.send({
        embeds: [embed],
        components: [buildReviewButtons(id)],
      });
      reviewMessageId = msg.id;
    }
  } catch (err) {
    log.error("Failed to post to review channel", err);
  }

  offer.reviewMessageId = reviewMessageId;
  const saveRes = await offerStore.set(id, offer);
  if (saveRes.isErr()) {
    // Clean up review message if save failed
    if (reviewMessageId && reviewChannelId) {
      try {
        const ch = await guild.channels.fetch(reviewChannelId);
        if (ch?.isTextBased() && "messages" in ch) {
          await (ch as { messages: { delete(id: string): Promise<unknown> } }).messages.delete(reviewMessageId).catch(() => null);
        }
      } catch { /* best-effort */ }
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
  const res = await offerStore.get(offerId);
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
        const embed = buildOfferEmbed(offer, "APPROVED");
        const msg = await approvedChannel.send({
          content: `<@${offer.authorId}> ✅ Your offer has been approved!`,
          embeds: [embed],
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
  await offerStore.set(offerId, updated);

  // DM author
  try {
    const user = await guild.client.users.fetch(offer.authorId);
    await user.send({ content: `✅ Your offer **${offer.details.title}** has been approved!` }).catch(() => null);
  } catch { /* best-effort */ }

  return OkResult(updated);
}

export async function rejectOffer(
  guild: DjsGuild,
  offerId: string,
  moderatorId: string,
  reason: string,
): Promise<Result<Offer>> {
  const res = await offerStore.get(offerId);
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
  await offerStore.set(offerId, updated);

  try {
    const user = await guild.client.users.fetch(offer.authorId);
    await user.send({
      content: `❌ Your offer **${offer.details.title}** was rejected.\n**Reason:** ${reason}`,
    }).catch(() => null);
  } catch { /* best-effort */ }

  return OkResult(updated);
}

export async function requestChanges(
  guild: DjsGuild,
  offerId: string,
  moderatorId: string,
  note: string,
): Promise<Result<Offer>> {
  const res = await offerStore.get(offerId);
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
  await offerStore.set(offerId, updated);

  try {
    const user = await guild.client.users.fetch(offer.authorId);
    await user.send({
      content: `🔄 Changes were requested for your offer **${offer.details.title}**.\n**Note:** ${note}`,
    }).catch(() => null);
  } catch { /* best-effort */ }

  return OkResult(updated);
}

export async function withdrawOffer(
  guildId: string,
  authorId: string,
): Promise<Result<boolean>> {
  const res = await findActiveByAuthor(guildId, authorId);
  if (res.isErr()) return ErrResult(res.error);

  const offer = res.unwrap();
  if (!offer) return OkResult(false);

  const updated: Offer = { ...offer, status: "WITHDRAWN", updatedAt: new Date() };
  await offerStore.set(offer._id, updated);
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

    const embed = buildOfferEmbed({ ...offer, status, rejectionReason: note, changesNote: note }, status);
    await (ch as { messages: { edit(id: string, opts: unknown): Promise<unknown> } }).messages.edit(
      offer.reviewMessageId,
      { embeds: [embed], components: [buildReviewButtons(offer._id, disabled)] },
    );
  } catch (err) {
    log.error("Failed to update review message", err);
  }
}

export { buildReviewButtons };

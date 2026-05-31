import { z } from "zod";

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

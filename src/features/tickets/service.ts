/**
 * Ticket service.
 *
 * Manages ticket channel lifecycle: open (create channel, track owner),
 * close (delete channel, remove tracking). One open ticket per user per guild.
 *
 * State: sessions store keys `ticket:{guildId}:{userId}` → channelId string.
 * Durable state: `Ticket` by channel id and `UserTickets` by guild/user id.
 */

import { ChannelType, type Guild as DjsGuild } from "discord.js";
import { Ticket } from "@/components/ticket";
import { UserTickets, userTicketsId } from "@/components/user-tickets";
import { ErrResult, OkResult, type Result } from "@/core/result";
import type { Ctx } from "@/framework/types";

export class TicketError extends Error {
  constructor(
    message: string,
    public readonly code: "LIMIT_REACHED" | "NO_CATEGORY" | "DB_ERROR" | "DISCORD_ERROR",
  ) {
    super(message);
    this.name = "TicketError";
  }
}

export interface OpenTicketOptions {
  categoryId: string;
  channelName: string;
  maxPerUser?: number;
}

export interface OpenTicketResult {
  channelId: string;
}

export const TICKET_CATEGORIES = [
  {
    id: "report",
    label: "Report",
    description: "Report bad behavior from other users.",
    emoji: "❗",
  },
  {
    id: "featured",
    label: "Featured Notice",
    description: "Inquire about or purchase advertisement.",
    emoji: "📣",
  },
  {
    id: "workshop",
    label: "Give a Workshop",
    description: "Host a workshop on the server.",
    emoji: "🎓",
  },
  {
    id: "alliance",
    label: "Request Server Alliance",
    description: "Minimum 300 users, must comply with TOS.",
    emoji: "🤝",
  },
  {
    id: "general",
    label: "General",
    description: "If none of the above options apply.",
    emoji: "❓",
  },
] as const;

export type TicketCategoryId = (typeof TICKET_CATEGORIES)[number]["id"];

function sessionKey(guildId: string, userId: string): string {
  return `ticket:${guildId}:${userId}`;
}

function buildChannelName(username: string): string {
  const sanitized =
    username
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "user";
  return `ticket-${sanitized}`.slice(0, 100);
}

export function makeTicketChannelName(username: string): string {
  return buildChannelName(username);
}

/**
 * Opens a ticket: creates a text channel under `categoryId`, registers it
 * in the sessions store and in the guild's `pendingTickets` array.
 * Returns TicketError with code LIMIT_REACHED if the user already has a ticket.
 */
export async function openTicket(
  ctx: Ctx,
  guild: DjsGuild,
  userId: string,
  opts: OpenTicketOptions,
): Promise<Result<OpenTicketResult>> {
  const maxPerUser = opts.maxPerUser ?? 1;
  const ticketStateId = userTicketsId(guild.id, userId);
  const userTickets = await ctx.ensure(ticketStateId, UserTickets);

  if (maxPerUser > 0) {
    const existingSession = ctx.sessions.get(sessionKey(guild.id, userId));
    if (existingSession || userTickets.openChannelIds.length >= maxPerUser) {
      return ErrResult(new TicketError("You already have an open ticket.", "LIMIT_REACHED"));
    }
  }

  let channel: { id: string; delete(reason?: string): Promise<unknown> } | null = null;
  try {
    channel = await guild.channels.create({
      name: opts.channelName,
      type: ChannelType.GuildText,
      parent: opts.categoryId,
    });
  } catch (err) {
    ctx.logger.error("Failed to create ticket channel", err);
    return ErrResult(new TicketError("Failed to create ticket channel.", "DISCORD_ERROR"));
  }

  const channelId = channel.id;

  try {
    await ctx.set(channelId, Ticket, {
      guildId: guild.id,
      ownerId: userId,
      category: "general",
      createdAt: new Date(),
    });
    await ctx.patch(ticketStateId, UserTickets, (current) => ({
      openChannelIds: [...new Set([...current.openChannelIds, channelId])],
    }));
    ctx.sessions.set(sessionKey(guild.id, userId), channelId);
  } catch (err) {
    ctx.logger.error("Failed to record ticket in DB", err);
    await ctx.delete(channelId, Ticket).catch(() => {});
    await channel.delete("Ticket persistence failed").catch(() => {});
    return ErrResult(new TicketError("Failed to record ticket in DB.", "DB_ERROR"));
  }

  return OkResult({ channelId });
}

/**
 * Closes a ticket: deletes the channel, removes from sessions and pendingTickets.
 * `ownerId` is optional — if provided, the session key is cleaned up.
 */
export async function closeTicket(
  ctx: Ctx,
  guild: DjsGuild,
  channelId: string,
  ownerId?: string,
): Promise<Result<void>> {
  const ticket = await ctx.get(channelId, Ticket);
  const resolvedOwnerId = ownerId ?? ticket?.ownerId;

  // Delete the Discord channel
  try {
    const ch =
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(channelId).catch(() => null));
    if (ch) await ch.delete("Ticket closed").catch(() => null);
  } catch (err) {
    ctx.logger.error("Failed to delete ticket channel", err);
    // Continue — still clean up DB state
  }

  try {
    await ctx.delete(channelId, Ticket);
    if (resolvedOwnerId) {
      const ticketStateId = userTicketsId(guild.id, resolvedOwnerId);
      await ctx.patch(ticketStateId, UserTickets, (current) => ({
        openChannelIds: current.openChannelIds.filter((id) => id !== channelId),
      }));
      ctx.sessions.delete(sessionKey(guild.id, resolvedOwnerId));
    }
  } catch (err) {
    ctx.logger.error("Failed to remove ticket from DB", err);
    return ErrResult(new TicketError("Failed to remove ticket from DB.", "DB_ERROR"));
  }

  return OkResult(undefined);
}

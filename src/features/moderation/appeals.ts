/**
 * Appeals queue management.
 *
 * Two concerns live here:
 * 1. `buildQueuePayload` — pure render: Appeal[] → V2Payload. No side effects.
 * 2. `syncQueueMessage` — effectful: fetches pending appeals, builds payload,
 *    edits or creates the guild's queue message, and marks it as important.
 *
 * `syncQueueMessage` is idempotent and safe to call from multiple code paths
 * (submission, approval, denial). It always rebuilds from the full pending
 * appeal list rather than applying incremental diffs, so the message is always
 * consistent with DB state regardless of order-of-operations.
 */
import { ButtonBuilder, ButtonStyle, type Client, type Guild, type TextChannel } from "discord.js";
import { markImportant, unmarkImportant } from "@/core/importantMessages";
import { getPendingAppeals } from "@/db/repositories/appeals";
import { getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import type { Appeal } from "@/db/schemas/appeal";
import { container, section, text, v2Message } from "@/ui/v2";
import type { V2Payload } from "@/ui/views";

/** Maximum number of appeal Sections shown in one queue message. */
const MAX_QUEUE_DISPLAY = 10;

/**
 * Pure render: converts a list of pending appeals into a V2 message payload.
 *
 * Empty list → "No open appeals" mute container.
 * Non-empty → one Section per appeal (capped at MAX_QUEUE_DISPLAY) plus an
 * overflow note if more exist. Each Section carries a "Review" button whose
 * customId encodes the guildId and caseId needed by the review handler.
 */
export function buildQueuePayload(appeals: Appeal[]): V2Payload {
  if (appeals.length === 0) {
    return v2Message(container("mute", text("## No open appeals")));
  }

  const capped = appeals.slice(0, MAX_QUEUE_DISPLAY);
  const overflow = appeals.length - capped.length;

  const children: Parameters<typeof container>[1][] = capped.map((appeal) => {
    const ts = Math.floor(new Date(appeal.submittedAt).getTime() / 1000);
    const reason = appeal.reason.length > 150 ? `${appeal.reason.slice(0, 150)}…` : appeal.reason;

    const reviewButton = new ButtonBuilder()
      .setCustomId(`appeal:review:${appeal.guildId}:${appeal.caseId}`)
      .setLabel("Review")
      .setStyle(ButtonStyle.Primary);

    const body = `**@${appeal.userTag}** · Case #${appeal.caseId} · <t:${ts}:R>\n> ${reason}`;
    return section(body, reviewButton);
  });

  if (overflow > 0) {
    children.push(text(`-# +${overflow} more appeal${overflow === 1 ? "" : "s"} not shown`));
  }

  return v2Message(container("info", ...children));
}

/**
 * Rebuilds the guild's queue message from current DB state and edits it in
 * place. Creates a new message (and stores its ID in guild config) if none
 * exists or the stored message was deleted.
 *
 * Safe to call concurrently — the worst case is two edits in quick succession,
 * not data corruption. Discord will reject a second edit on a deleted message
 * and the fallback create path handles it.
 */
export async function syncQueueMessage(guild: Guild, _client: Client): Promise<void> {
  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr()) return;
  const guildData = guildResult.unwrap();
  if (!guildData) return;

  const channelId = guildData.moderation.appealsChannelId;
  if (!channelId) return;

  const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  if (!channel?.isTextBased()) return;

  const pending = await getPendingAppeals(guild.id);
  const payload = buildQueuePayload(pending);

  const storedId = guildData.moderation.appealsQueueMessageId;

  if (storedId) {
    const existing = await channel.messages.fetch(storedId).catch(() => null);
    if (existing) {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: V2 payload valid at runtime; discord.js types lag.
        await existing.edit(payload as any);
        return;
      } catch {
        // Message exists but edit failed — fall through to recreate.
        unmarkImportant(storedId);
      }
    } else {
      unmarkImportant(storedId);
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: V2 payload valid at runtime; discord.js types lag.
  const newMessage = await channel.send(payload as any);
  await updateGuildPaths(guild.id, {
    "moderation.appealsQueueMessageId": newMessage.id,
  });

  markImportant(newMessage, "Appeals queue message", async (_ch) => {
    const fresh = await getPendingAppeals(guild.id);
    return {
      payload: buildQueuePayload(fresh),
      onRestored: async (restored) => {
        await updateGuildPaths(guild.id, {
          "moderation.appealsQueueMessageId": restored.id,
        });
      },
    };
  });
}

/**
 * On bot startup, re-registers the guild's queue message as important if one
 * is stored in config. Call once per guild that has an active appeals channel.
 */
export async function reregisterQueueMessage(guild: Guild): Promise<void> {
  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr()) return;
  const guildData = guildResult.unwrap();
  if (!guildData) return;

  const { appealsChannelId, appealsQueueMessageId } = guildData.moderation;
  if (!appealsChannelId || !appealsQueueMessageId) return;

  const channel = (await guild.channels
    .fetch(appealsChannelId)
    .catch(() => null)) as TextChannel | null;
  if (!channel) return;

  const message = await channel.messages.fetch(appealsQueueMessageId).catch(() => null);
  if (!message) {
    // Message is gone — will be recreated on next appeal event.
    await updateGuildPaths(guild.id, { "moderation.appealsQueueMessageId": null });
    return;
  }

  markImportant(message, "Appeals queue message", async (_ch) => {
    const fresh = await getPendingAppeals(guild.id);
    return {
      payload: buildQueuePayload(fresh),
      onRestored: async (restored) => {
        await updateGuildPaths(guild.id, {
          "moderation.appealsQueueMessageId": restored.id,
        });
      },
    };
  });
}

/**
 * Important Messages — framework-level protection for bot-created messages.
 *
 * Some messages (e.g., the appeals queue) are structural: losing them breaks
 * a feature. This module tracks such messages in an in-memory registry. When
 * Discord fires messageDelete for a registered message, the bot re-posts the
 * content via the caller-supplied restore callback and updates the stored ID.
 *
 * Persistence: the registry is in-memory only. Features re-register their
 * messages on startup by reading IDs from wherever they already persist them
 * (e.g., guild config). No separate DB collection is needed.
 *
 * Caller contract: the restore callback must be idempotent and non-throwing;
 * any error is logged and the re-post is abandoned rather than retried.
 */
import type { Client, Message, TextChannel } from "discord.js";
import { createLogger } from "./logger";
import type { V2Payload } from "@/ui/views";

const log = createLogger("importantMessages");

export interface ImportantMessageEntry {
  /** Channel the message lives in. */
  readonly channelId: string;
  /** Guild the message belongs to. */
  readonly guildId: string;
  /** Human-readable reason, used in error logs. */
  readonly reason: string;
  /**
   * Called when the original message is deleted. Returns the payload to
   * re-post and a callback that fires once the new message is sent so the
   * feature can update its persisted message ID.
   */
  restore(channel: TextChannel): Promise<{
    payload: V2Payload;
    onRestored(newMessage: Message): Promise<void>;
  }>;
}

const registry = new Map<string, ImportantMessageEntry>();

/**
 * Registers a message as important. If it is deleted, the bot will
 * automatically re-post it using the restore callback.
 */
export function markImportant(
  message: Message,
  reason: string,
  restore: ImportantMessageEntry["restore"],
): void {
  registry.set(message.id, {
    channelId: message.channelId,
    guildId: message.guildId ?? "",
    reason,
    restore,
  });
}

/**
 * Removes a message from the registry. Call before re-registering a
 * replacement to avoid stale entries accumulating.
 */
export function unmarkImportant(messageId: string): void {
  registry.delete(messageId);
}

/**
 * Returns the registry entry for a message ID, or undefined if not tracked.
 */
export function getImportantMessage(messageId: string): ImportantMessageEntry | undefined {
  return registry.get(messageId);
}

/**
 * Wires the messageDelete Discord gateway event to the registry. Must be
 * called exactly once at bot startup after the client is initialised.
 */
export function registerMessageDeleteListener(client: Client): void {
  client.on("messageDelete", async (message) => {
    const entry = registry.get(message.id);
    if (!entry) return;

    unmarkImportant(message.id);
    log.info("Important message deleted — restoring", { reason: entry.reason, id: message.id });

    try {
      const channel = message.channel as TextChannel;
      const { payload, onRestored } = await entry.restore(channel);
      // biome-ignore lint/suspicious/noExplicitAny: V2 payload valid at runtime; discord.js types lag.
      const newMessage = await channel.send(payload as any);
      markImportant(newMessage, entry.reason, entry.restore);
      await onRestored(newMessage);
    } catch (err) {
      log.error("Failed to restore important message", { reason: entry.reason, error: err });
    }
  });
}

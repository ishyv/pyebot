/**
 * AI message handler — responds to @mentions and replies to prior AI messages.
 *
 * Export: handleAiMessage(message, botId) — called by the root handlers.ts via @Listen.
 */

import type { Message } from "discord.js";
import { createLogger } from "@/core/logger";
import { generateResponse } from "@/features/ai/service";

const log = createLogger("ai:message");

const AI_MARKER = "\u200B"; // zero-width space appended to AI messages for detection

function markAIMessage(text: string): string {
  return text.endsWith(AI_MARKER) ? text : `${text}${AI_MARKER}`;
}

function isAIMessage(content: string): boolean {
  return content.endsWith(AI_MARKER);
}

function stripBotMention(content: string, botId: string): string {
  return content.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();
}

async function resolveReplyContext(
  message: Message,
  botId: string,
): Promise<{ shouldReply: boolean; quotedText?: string }> {
  const ref = message.reference;
  if (!ref?.messageId) return { shouldReply: false };

  try {
    const referenced = message.channel.isTextBased()
      ? await message.channel.messages.fetch(ref.messageId)
      : null;

    if (!referenced) return { shouldReply: false };
    if (referenced.author.id !== botId) return { shouldReply: false };
    if (!isAIMessage(referenced.content)) return { shouldReply: false };

    const stripped = referenced.content.replace(/\u200B$/, "").trim();
    return { shouldReply: true, quotedText: stripped };
  } catch {
    return { shouldReply: false };
  }
}

function splitLongMessage(text: string, maxLen = 1900): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const cut = remaining.lastIndexOf("\n", maxLen);
    const at = cut > 0 ? cut : maxLen;
    chunks.push(remaining.slice(0, at));
    remaining = remaining.slice(at).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export async function handleAiMessage(message: Message, botId: string): Promise<void> {
  try {
    if (message.author.bot) return;

    const mentioned = message.mentions.has(botId);
    const { shouldReply, quotedText } = await resolveReplyContext(message, botId);

    if (!mentioned && !shouldReply) return;

    const rawContent = stripBotMention(message.content, botId);
    const userMessage = [quotedText ? `[Context: ${quotedText}]` : "", rawContent]
      .filter(Boolean)
      .join("\n");

    if (!userMessage.trim()) {
      await message.reply({ content: "Yes?" });
      return;
    }

    if ("sendTyping" in message.channel) {
      await (message.channel as { sendTyping(): Promise<void> }).sendTyping().catch(() => null);
    }

    const result = await generateResponse({
      guildId: message.guildId,
      userId: message.author.id,
      message: userMessage,
    });

    const text = result.text.trim() || "I have nothing to say.";
    const chunks = splitLongMessage(text);

    for (let i = 0; i < chunks.length; i++) {
      const content = i === chunks.length - 1 ? markAIMessage(chunks[i]) : chunks[i];
      if (i === 0) {
        await message.reply({ content });
      } else if ("send" in message.channel) {
        await (message.channel as { send(opts: { content: string }): Promise<unknown> }).send({
          content,
        });
      }
    }
  } catch (err) {
    log.error("Error in AI messageCreate handler", err);
  }
}

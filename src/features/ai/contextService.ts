import { ErrResult, OkResult, type Result } from "@/core/result";

export const CONTEXT_PERIODS = [
  { value: "15m", label: "15 minutes", minutes: 15 },
  { value: "30m", label: "30 minutes", minutes: 30 },
  { value: "60m", label: "1 hour", minutes: 60 },
  { value: "120m", label: "2 hours", minutes: 120 },
] as const;

export type ContextPeriodValue = (typeof CONTEXT_PERIODS)[number]["value"];
export type ContextPeriod = (typeof CONTEXT_PERIODS)[number];

export interface ContextFetchableMessage {
  readonly id: string;
  readonly createdTimestamp: number;
  readonly content?: string | null;
  readonly author?: {
    readonly id?: string;
    readonly username?: string | null;
    readonly displayName?: string | null;
    readonly tag?: string | null;
    readonly bot?: boolean;
  } | null;
  readonly attachments?: Iterable<unknown> | { values(): Iterable<unknown> } | null;
  readonly embeds?: readonly ContextFetchableEmbed[] | null;
}

export interface ContextFetchableEmbed {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly fields?: readonly { readonly name?: string | null; readonly value?: string | null }[] | null;
}

export interface ContextFetchableChannel {
  readonly messages?: {
    fetch(options: { limit: number; before?: string }): Promise<
      Iterable<ContextFetchableMessage> | { values(): Iterable<ContextFetchableMessage> }
    >;
  };
}

export interface CollectedContextMessage {
  readonly id: string;
  readonly authorName: string;
  readonly authorIsBot: boolean;
  readonly createdTimestamp: number;
  readonly text: string;
}

export interface CollectedChannelContext {
  readonly period: ContextPeriod;
  readonly messages: readonly CollectedContextMessage[];
  readonly transcript: string;
  readonly totalFetched: number;
  readonly truncatedByMessages: boolean;
  readonly truncatedByChars: boolean;
}

export type ContextCollectionErrorCode = "UNSUPPORTED_CHANNEL" | "FETCH_FAILED";

export class ContextCollectionError extends Error {
  constructor(
    public readonly code: ContextCollectionErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ContextCollectionError";
  }
}

export interface CollectChannelContextOptions {
  readonly periodMinutes: number;
  readonly now?: number;
  readonly maxMessages?: number;
  readonly maxTranscriptChars?: number;
  readonly maxMessageChars?: number;
}

const DEFAULT_MAX_MESSAGES = 500;
const DEFAULT_MAX_TRANSCRIPT_CHARS = 28_000;
const DEFAULT_MAX_MESSAGE_CHARS = 600;
const DISCORD_FETCH_LIMIT = 100;

export function normalizeContextPeriod(value: string | null | undefined): ContextPeriod {
  return CONTEXT_PERIODS.find((period) => period.value === value) ?? CONTEXT_PERIODS[1];
}

export async function collectChannelContext(
  channel: ContextFetchableChannel,
  options: CollectChannelContextOptions,
): Promise<Result<CollectedChannelContext, ContextCollectionError>> {
  if (!channel.messages?.fetch) {
    return ErrResult(
      new ContextCollectionError("UNSUPPORTED_CHANNEL", "This channel does not expose message history."),
    );
  }

  const period = periodFromMinutes(options.periodMinutes);
  const now = options.now ?? Date.now();
  const cutoff = now - period.minutes * 60_000;
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const maxTranscriptChars = options.maxTranscriptChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS;
  const maxMessageChars = options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS;

  const collected: CollectedContextMessage[] = [];
  let before: string | undefined;
  let totalFetched = 0;
  let reachedCutoff = false;

  try {
    while (!reachedCutoff && collected.length < maxMessages) {
      const fetchOptions = before
        ? { limit: Math.min(DISCORD_FETCH_LIMIT, maxMessages - collected.length), before }
        : { limit: Math.min(DISCORD_FETCH_LIMIT, maxMessages - collected.length) };
      const batch = messageValues(await channel.messages.fetch(fetchOptions));
      if (batch.length === 0) break;

      for (const msg of batch) {
        totalFetched += 1;
        before = msg.id;

        if (msg.createdTimestamp < cutoff) {
          reachedCutoff = true;
          break;
        }

        const normalized = normalizeMessage(msg, maxMessageChars);
        if (normalized) collected.push(normalized);
        if (collected.length >= maxMessages) break;
      }
    }
  } catch (cause) {
    return ErrResult(new ContextCollectionError("FETCH_FAILED", "Failed to fetch channel messages.", cause));
  }

  const chronological = [...collected].reverse();
  const capped = capTranscript(chronological, maxTranscriptChars);

  return OkResult({
    period,
    messages: capped.messages,
    transcript: capped.transcript,
    totalFetched,
    truncatedByMessages: collected.length >= maxMessages,
    truncatedByChars: capped.truncatedByChars,
  });
}

function periodFromMinutes(minutes: number): ContextPeriod {
  return CONTEXT_PERIODS.find((period) => period.minutes === minutes) ?? CONTEXT_PERIODS[1];
}

function normalizeMessage(
  message: ContextFetchableMessage,
  maxMessageChars: number,
): CollectedContextMessage | null {
  const authorName = cleanInline(
    message.author?.displayName
      ?? message.author?.username
      ?? message.author?.tag
      ?? message.author?.id
      ?? "Unknown",
  );
  const parts = [
    message.content?.trim() ?? "",
    attachmentText(message.attachments),
    embedText(message.embeds),
  ].filter(Boolean);

  const text = truncate(parts.join(" "), maxMessageChars);
  if (!text) return null;

  return {
    id: message.id,
    authorName,
    authorIsBot: message.author?.bot ?? false,
    createdTimestamp: message.createdTimestamp,
    text,
  };
}

function attachmentText(attachments: ContextFetchableMessage["attachments"]): string {
  const values = iterableValues(attachments);
  if (!values.length) return "";

  const names = values
    .map((attachment) => {
      if (typeof attachment !== "object" || attachment === null) return "";
      const record = attachment as { name?: unknown; filename?: unknown };
      const name = record.name ?? record.filename;
      return typeof name === "string" ? cleanInline(name) : "";
    })
    .filter(Boolean);

  return names.length ? `[attachments: ${names.join(", ")}]` : "";
}

function embedText(embeds: ContextFetchableMessage["embeds"]): string {
  if (!embeds?.length) return "";
  const snippets = embeds.flatMap((embed) => [
    embed.title ?? "",
    embed.description ?? "",
    ...(embed.fields ?? []).flatMap((field) => [field.name ?? "", field.value ?? ""]),
  ]);
  const text = snippets.map(cleanInline).filter(Boolean).join(" ");
  return text ? `[embed: ${truncate(text, 300)}]` : "";
}

function iterableValues(input: ContextFetchableMessage["attachments"]): unknown[] {
  if (!input) return [];
  if (typeof (input as { values?: unknown }).values === "function") {
    return [...(input as { values(): Iterable<unknown> }).values()];
  }
  return [...input as Iterable<unknown>];
}

function messageValues(
  input: Iterable<ContextFetchableMessage> | { values(): Iterable<ContextFetchableMessage> },
): ContextFetchableMessage[] {
  if (typeof (input as { values?: unknown }).values === "function") {
    return [...(input as { values(): Iterable<ContextFetchableMessage> }).values()];
  }
  return [...input as Iterable<ContextFetchableMessage>];
}

function capTranscript(
  messages: readonly CollectedContextMessage[],
  maxTranscriptChars: number,
): { messages: readonly CollectedContextMessage[]; transcript: string; truncatedByChars: boolean } {
  const kept: CollectedContextMessage[] = [];
  let total = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const line = transcriptLine(msg);
    const nextTotal = total === 0 ? line.length : total + 1 + line.length;
    if (kept.length > 0 && nextTotal > maxTranscriptChars) break;
    if (kept.length === 0 && line.length > maxTranscriptChars) {
      kept.push({ ...msg, text: truncate(msg.text, Math.max(0, maxTranscriptChars - 40)) });
      total = transcriptLine(kept[0]).length;
      break;
    }
    kept.push(msg);
    total = nextTotal;
  }

  const chronological = kept.reverse();
  return {
    messages: chronological,
    transcript: chronological.map(transcriptLine).join("\n"),
    truncatedByChars: chronological.length < messages.length,
  };
}

function transcriptLine(message: CollectedContextMessage): string {
  const timestamp = new Date(message.createdTimestamp).toISOString().slice(11, 16);
  const botLabel = message.authorIsBot ? " bot" : "";
  return `[${timestamp}] ${message.authorName}${botLabel}: ${message.text}`;
}

function cleanInline(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxChars: number): string {
  const clean = cleanInline(value);
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 1) return clean.slice(0, maxChars);
  if (maxChars <= 3) return clean.slice(0, maxChars);
  return `${clean.slice(0, maxChars - 3).trimEnd()}...`;
}

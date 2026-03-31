/**
 * AI service — multi-provider text generation (Gemini, OpenAI).
 *
 * Provider/model resolved from guild config (`guild.ai.provider`, `guild.ai.model`).
 * Per-user conversation memory kept in the global sessions store.
 * Rate limiting uses a MongoDB `ai_rate_limits` collection.
 */

import { GoogleGenAI, type Content } from "@google/genai";
import OpenAI from "openai";
import { getGuild } from "@/db/repositories/guilds";
import { getDb } from "@/core/db";
import { sessions } from "@/core/state";
import { createLogger } from "@/core/logger";

const log = createLogger("ai");

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_PROVIDER = "gemini";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;
export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;

export type ProviderId = "gemini" | "openai";

const BOT_PROMPT =
  "You are a helpful, friendly Discord bot assistant. Keep responses concise and appropriate for chat.";

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

const MAX_MEMORY_MESSAGES = 20;

function memoryKey(userId: string): string {
  return `ai_memory:${userId}`;
}

export function getMemory(userId: string): ChatMessage[] {
  return (sessions.get(memoryKey(userId)) as ChatMessage[] | undefined) ?? [];
}

export function appendMemory(userId: string, msg: ChatMessage): void {
  const memory = getMemory(userId);
  memory.push(msg);
  if (memory.length > MAX_MEMORY_MESSAGES) memory.splice(0, memory.length - MAX_MEMORY_MESSAGES);
  sessions.set(memoryKey(userId), memory);
}

export function clearMemory(userId: string): void {
  sessions.delete(memoryKey(userId));
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

interface RateLimitDoc {
  _id: string;
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  guildId: string,
  userId: string,
  maxUses: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = `${guildId}:${userId}`;
  const windowMs = windowSeconds * 1000;
  const now = Date.now();

  try {
    const db = await getDb();
    const col = db.collection<RateLimitDoc>("ai_rate_limits");

    const existing = await col.findOne({ _id: key } as never);

    if (existing && now < existing.resetAt) {
      if (existing.count >= maxUses) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt };
      }
      const res = await col.findOneAndUpdate(
        { _id: key } as never,
        { $inc: { count: 1 } } as never,
        { returnDocument: "after" },
      );
      const count = (res as RateLimitDoc | null)?.count ?? existing.count + 1;
      return { allowed: true, remaining: Math.max(0, maxUses - count), resetAt: existing.resetAt };
    }

    const resetAt = now + windowMs;
    await col.updateOne(
      { _id: key } as never,
      { $set: { count: 1, resetAt } } as never,
      { upsert: true },
    );
    return { allowed: true, remaining: maxUses - 1, resetAt };
  } catch (err) {
    log.error("Rate limit check failed", err);
    return { allowed: true, remaining: 0, resetAt: Date.now() + windowMs };
  }
}

// ─── Provider resolution ──────────────────────────────────────────────────────

async function resolveProvider(guildId?: string | null): Promise<{
  providerId: ProviderId;
  model: string;
}> {
  let providerId: ProviderId = DEFAULT_PROVIDER;
  let model = DEFAULT_GEMINI_MODEL;

  if (guildId) {
    const res = await getGuild(guildId);
    if (res.isOk() && res.unwrap()) {
      const aiConfig = res.unwrap()!.ai;
      if (aiConfig.provider === "openai" || aiConfig.provider === "gemini") {
        providerId = aiConfig.provider;
        model = aiConfig.model;
      }
    }
  }

  // Validate model is known for provider
  if (providerId === "gemini" && !(GEMINI_MODELS as readonly string[]).includes(model)) {
    model = DEFAULT_GEMINI_MODEL;
  } else if (providerId === "openai" && !(OPENAI_MODELS as readonly string[]).includes(model)) {
    model = DEFAULT_OPENAI_MODEL;
  }

  return { providerId, model };
}

// ─── Generation ───────────────────────────────────────────────────────────────

export interface GenerateOptions {
  guildId?: string | null;
  userId: string;
  message: string;
}

export interface GenerateResult {
  text: string;
  providerId: ProviderId;
  model: string;
}

export async function generateResponse(opts: GenerateOptions): Promise<GenerateResult> {
  const { providerId, model } = await resolveProvider(opts.guildId);
  const memory = getMemory(opts.userId);

  let text: string;

  try {
    if (providerId === "gemini") {
      text = await callGemini(model, memory, opts.message);
    } else {
      text = await callOpenAI(model, memory, opts.message);
    }
  } catch (err) {
    log.error("AI generation error", err);
    text = "Sorry, I encountered an error generating a response.";
  }

  appendMemory(opts.userId, { role: "user", content: opts.message });
  appendMemory(opts.userId, { role: "model", content: text });

  return { text, providerId, model };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

let _gemini: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

async function callGemini(
  model: string,
  memory: ChatMessage[],
  message: string,
): Promise<string> {
  const contents: Content[] = [
    { role: "user", parts: [{ text: BOT_PROMPT }] },
    ...memory.map((m) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const response = await getGemini().models.generateContent({
    model,
    contents,
    config: { maxOutputTokens: 2048, temperature: 0.7 },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response.";
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

async function callOpenAI(
  model: string,
  memory: ChatMessage[],
  message: string,
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: BOT_PROMPT },
    ...memory.map((m) => ({
      role: m.role === "model" ? ("assistant" as const) : (m.role as "user" | "assistant"),
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const completion = await getOpenAI().chat.completions.create({ model, messages, max_tokens: 2048 });
  return completion.choices[0]?.message?.content ?? "No response.";
}

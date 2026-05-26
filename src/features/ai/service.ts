/**
 * AI service — multi-provider text generation via Vercel AI SDK.
 *
 * Implements fallback priority: Anthropic -> OpenAI -> Google
 * Per-user conversation memory kept in the global sessions store.
 * Rate limiting uses a MongoDB `ai_rate_limits` collection.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  type FlexibleSchema,
  generateObject,
  generateText,
  type InferSchema,
  type LanguageModel,
} from "ai";

import { getDb } from "@/core/db";
import { getEnv } from "@/core/env";
import { createLogger } from "@/core/logger";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { sessions } from "@/core/state";

import { aiConfig, type ModelTier, type ProviderId } from "./config";

const log = createLogger("ai");

export const DEFAULT_PROVIDER = "anthropic";

const BOT_PROMPT =
  "You are a helpful, friendly Discord bot assistant. Keep responses concise and appropriate for chat.";

// Initialize custom providers to map user `.env` variables
const env = getEnv();
const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY,
});
const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

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
    await col.updateOne({ _id: key } as never, { $set: { count: 1, resetAt } } as never, {
      upsert: true,
    });
    return { allowed: true, remaining: maxUses - 1, resetAt };
  } catch (err) {
    log.error("Rate limit check failed", err);
    return { allowed: true, remaining: 0, resetAt: Date.now() + windowMs };
  }
}

// ─── Vercel Model Resolver ───────────────────────────────────────────────────

function getModelInstance(provider: ProviderId, tier: ModelTier): LanguageModel {
  const modelName = aiConfig.providers[provider][tier];
  switch (provider) {
    case "anthropic":
      return anthropic(modelName);
    case "openai":
      return openai(modelName);
    case "google":
      return google(modelName);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function getModelName(provider: ProviderId, tier: ModelTier): string {
  return aiConfig.providers[provider][tier];
}

// ─── Unified Multi-Provider Text Generation ──────────────────────────────────

/**
 * Iterates through the priority list of providers until one successfully generates text.
 */
export async function generateResilientText(
  systemPrompt: string,
  userPrompt: string,
  tier: ModelTier = "mid",
): Promise<{ text: string; providerId: ProviderId }> {
  let lastError: unknown = null;

  for (const provider of aiConfig.priority) {
    try {
      const model = getModelInstance(provider, tier);

      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.9,
      });

      return { text: text.trim(), providerId: provider };
    } catch (err) {
      log.error(
        `[AI Fallback] Provider ${provider} failed on tier ${tier}. Attempting next...`,
        err,
      );
      lastError = err;
    }
  }

  // If we reach this point, all providers failed
  throw new Error(`All providers failed to generate text. Last error: ${lastError}`);
}

// ─── Safe Structured Generation ──────────────────────────────────────────────

export type AiGenerationErrorCode = "provider_failed" | "all_providers_failed" | "invalid_model";

export class AiGenerationError extends Error {
  constructor(
    public readonly code: AiGenerationErrorCode,
    message: string,
    public readonly cause?: unknown,
    public readonly providerId?: ProviderId,
  ) {
    super(message);
    this.name = "AiGenerationError";
  }
}

export interface GenerateResilientObjectOptions {
  readonly tier?: ModelTier;
  readonly maxOutputTokens?: number;
  readonly timeout?: number | { totalMs?: number; stepMs?: number };
  readonly temperature?: number;
  readonly functionId?: string;
}

export interface GenerateResilientObjectResult<T> {
  readonly object: T;
  readonly providerId: ProviderId;
  readonly model: string;
}

export async function generateResilientObject<SCHEMA extends FlexibleSchema<unknown>>(
  schema: SCHEMA,
  systemPrompt: string,
  userPrompt: string,
  options: GenerateResilientObjectOptions = {},
): Promise<Result<GenerateResilientObjectResult<InferSchema<SCHEMA>>, AiGenerationError>> {
  const tier = options.tier ?? "mid";
  let lastError: AiGenerationError | null = null;

  for (const provider of aiConfig.priority) {
    const modelName = getModelName(provider, tier);
    try {
      const model = getModelInstance(provider, tier);
      const { object } = await generateObject<SCHEMA, "object", InferSchema<SCHEMA>>({
        model,
        schema,
        output: "object",
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: options.maxOutputTokens,
        temperature: options.temperature ?? 0.2,
        timeout: options.timeout,
        experimental_telemetry: options.functionId
          ? { isEnabled: false, functionId: options.functionId }
          : undefined,
      });

      return OkResult({ object, providerId: provider, model: modelName });
    } catch (cause) {
      const error = new AiGenerationError(
        "provider_failed",
        `Provider ${provider} failed while generating structured AI output.`,
        cause,
        provider,
      );
      log.error(
        `[AI Fallback] Provider ${provider} failed on tier ${tier}. Attempting next...`,
        cause,
      );
      lastError = error;
    }
  }

  return ErrResult(
    new AiGenerationError(
      "all_providers_failed",
      "All providers failed to generate structured AI output.",
      lastError,
    ),
  );
}

// ─── Legacy Chat Wrapper ──────────────────────────────────────────────────────────

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
  const memory = getMemory(opts.userId);

  // Format memory into a monolithic string for generic Vercel text call
  // (In a fuller refactor we would pass CoreMessages array to the Vercel generateText)
  const conversationContext = memory
    .map(
      (m) => `${m.role === "model" || m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`,
    )
    .join("\n");

  const fullPrompt = conversationContext
    ? `Past Conversation Context:\n${conversationContext}\n\nUser Current Message: ${opts.message}`
    : `User Current Message: ${opts.message}`;

  let text: string;
  let finalProvider: string = DEFAULT_PROVIDER;

  try {
    const res = await generateResilientText(BOT_PROMPT, fullPrompt, "mid");
    text = res.text;
    finalProvider = res.providerId;
  } catch (err) {
    log.error("AI generation error", err);
    text = "Sorry, I encountered an error generating a response across all providers.";
  }

  appendMemory(opts.userId, { role: "user", content: opts.message });
  appendMemory(opts.userId, { role: "assistant", content: text });

  return {
    text,
    providerId: finalProvider as ProviderId,
    model: aiConfig.providers[finalProvider as ProviderId].mid,
  };
}

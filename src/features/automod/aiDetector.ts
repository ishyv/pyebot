/**
 * Optional AI-assisted classification for ambiguous moderation context.
 * AI signals are report-only and never punishment-eligible by themselves.
 */

import type { Message } from "discord.js";
import { z } from "zod";
import type { AutomodConfig } from "@/db/schemas/guild";
import { generateResilientObject } from "@/features/ai/service";
import type { AutomodSignal } from "./signals";

const AiModerationClassification = z.object({
  category: z.enum(["safe", "toxicity", "harassment", "scam", "sexual", "violence"]),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(240),
});

const SYSTEM_PROMPT = [
  "Classify a Discord message for moderation review.",
  "Return safe unless the text clearly indicates toxicity, harassment, scam behavior, sexual content, or violence.",
  "Do not infer private attributes. Do not recommend punishment.",
].join(" ");

/**
 * Produces a report-only AI signal when enabled and confident enough.
 */
export async function detectAiClassificationSignals(
  message: Message,
  config: AutomodConfig,
): Promise<AutomodSignal[]> {
  if (!message.guild) return [];
  if (!config.policy.aiDetector.enabled) return [];
  const content = message.content.trim();
  if (content.length < 20) return [];

  const result = await generateResilientObject(
    AiModerationClassification,
    SYSTEM_PROMPT,
    content.slice(0, 1500),
    {
      tier: "low",
      maxOutputTokens: 180,
      temperature: 0,
      functionId: "automod.aiDetector",
    },
  );
  if (result.isErr()) return [];

  const classification = result.unwrap().object;
  if (classification.category === "safe") return [];
  if (classification.confidence < config.policy.aiDetector.minConfidence) return [];

  return [
    {
      detectorId: "aiClassifier",
      ruleId: `ai:${classification.category}`,
      confidence: classification.confidence,
      severity: classification.category === "scam" ? "high" : "medium",
      punishmentEligible: false,
      recommendedAction: "report",
      target: {
        guildId: message.guild.id,
        userId: message.author.id,
        channelId: message.channelId,
        messageId: message.id,
      },
      evidence: {
        summary: `AI classified message as ${classification.category}: ${classification.summary}`,
        messageContent: content.slice(0, 500),
        fingerprint: `ai:${classification.category}`,
      },
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * GuildAi — provider and model selection for the AI feature.
 *
 * The choice of provider (gemini/openai) and model name is per-guild so
 * admins can decide cost/quality tradeoffs locally.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const DEFAULT_AI_PROVIDER = "gemini";
export const DEFAULT_AI_MODEL = "gemini-2.5-flash";

export const GuildAi = component({
  collection: "guild_ai",
  schema: z.object({
    provider: z.string().default(DEFAULT_AI_PROVIDER),
    model: z.string().default(DEFAULT_AI_MODEL),
  }),
});

export type GuildAiValue = z.infer<typeof GuildAi.schema>;

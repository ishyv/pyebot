export type ProviderId = "anthropic" | "openai" | "google";
export type ModelTier = "low" | "mid" | "high";

export const aiConfig = {
  // Global priority: If Anthropic fails/rate-limits, fall back to OpenAI, etc.
  priority: ["anthropic","openai","google"] as ProviderId[],

  // Models mapped to providers and relative cost/performance tiers
  providers: {
    anthropic: {
      low: "claude-3-haiku-20240307",
      mid: "claude-haiku-4-5",
      high: "claude-sonnet-4-6",
    },
    openai: {
      low: "gpt-5-nano-2025-08-07",
      mid: "gpt-5.4-nano-2026-03-17",
      high: "gpt-5.4-mini-2026-03-17", 
    },
    google: {
      low: "gemini-2.5-flash-lite",
      mid: "gemini-2.5-flash",
      // Gemini doesn't always have a strict ultra 'high' publicly available on some keys but pro fits
      high: "gemini-2.5-pro", 
    }
  }
};

/**
 * featureGate middleware factory.
 *
 * Checks guild.features[key] and short-circuits if false.
 * This enforces the feature toggle system that exists in the guild DB schema
 * but was never checked at dispatch time.
 *
 * Usage: featureGateMw("economy") — checks guild.features.economy
 * The key should match a value in the Features enum from db/schemas/guild.ts.
 */

import type { MiddlewareFn } from "@/core/feature";
import { ErrResult, OkResult } from "@/core/result";

export function featureGateMw(key: string): MiddlewareFn {
  return async (_interaction, ctx) => {
    const enabled = (ctx.guildConfig.features as Record<string, boolean>)[key];
    if (enabled === false) {
      return ErrResult({ content: "This feature is disabled in this server." });
    }
    return OkResult(undefined);
  };
}

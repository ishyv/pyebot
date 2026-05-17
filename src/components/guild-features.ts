/**
 * GuildFeatures — per-guild on/off overrides for each registered feature.
 *
 * Stored as a flat record keyed by feature id. Absence of a key means
 * "use the feature's defaultEnabled value" — the middleware applies that
 * fallback on read, so this document only grows when an admin explicitly
 * toggles something.
 *
 * Why a separate component (rather than embedded in a "guild config" mega-
 * document)? Two reasons:
 *
 *   1. It is the one document touched by every interaction (the framework
 *      reads it before dispatching a command). Keeping it small and
 *      focused minimises read cost.
 *   2. Future settings (per-feature configuration) deserve their own
 *      components — bundling them all into one giant guild doc is what
 *      the old codebase did and it scaled poorly.
 */

import { z } from "zod";
import { getDb } from "@/core/db";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { component } from "@/framework/component";
import type { FeatureDescriptor } from "@/framework/types";

export const GuildFeatures = component({
  collection: "guild_features",
  schema: z.object({
    /**
     * Map of feature id → boolean override. `true` = explicitly enabled,
     * `false` = explicitly disabled. Missing key = use the feature's
     * defaultEnabled.
     */
    overrides: z.record(z.string(), z.boolean()).default({}),
  }),
});

export type GuildFeaturesValue = z.infer<typeof GuildFeatures.schema>;

/**
 * Resolve one feature's effective enabled state from stored overrides.
 * Missing override means "use the descriptor default"; omitted default means enabled.
 */
export function resolveFeatureEnabled(
  feature: Pick<FeatureDescriptor, "id" | "defaultEnabled">,
  overrides: Readonly<Record<string, boolean>> | null | undefined,
): boolean {
  return overrides?.[feature.id] ?? feature.defaultEnabled !== false;
}

/**
 * Apply one override to an in-memory GuildFeatures value.
 * This pure helper keeps tests and direct repository writes aligned.
 */
export function applyFeatureOverride(
  current: GuildFeaturesValue,
  featureId: string,
  enabled: boolean,
): GuildFeaturesValue {
  return {
    overrides: { ...current.overrides, [featureId]: enabled },
  };
}

/** Read feature-toggle overrides without requiring a framework Ctx. */
export async function getGuildFeatures(
  guildId: string,
): Promise<Result<GuildFeaturesValue, Error>> {
  try {
    const doc = await (await guildFeaturesCollection()).findOne({ _id: guildId });
    return OkResult(parseGuildFeatures(doc ?? {}));
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Set one feature-toggle override in the canonical guild_features document. */
export async function setGuildFeatureOverride(
  guildId: string,
  featureId: string,
  enabled: boolean,
): Promise<Result<GuildFeaturesValue, Error>> {
  return setGuildFeatureOverrides(guildId, { [featureId]: enabled });
}

/** Set multiple feature-toggle overrides in the canonical guild_features document. */
export async function setGuildFeatureOverrides(
  guildId: string,
  overrides: Readonly<Record<string, boolean>>,
): Promise<Result<GuildFeaturesValue, Error>> {
  try {
    const entries = Object.entries(overrides);
    if (entries.length === 0) return getGuildFeatures(guildId);
    const col = await guildFeaturesCollection();
    const res = await col.findOneAndUpdate(
      { _id: guildId },
      {
        $setOnInsert: { _id: guildId },
        $set: Object.fromEntries(
          entries.map(([featureId, enabled]) => [`overrides.${featureId}`, enabled]),
        ),
      },
      { upsert: true, returnDocument: "after" },
    );
    return OkResult(parseGuildFeatures(res ?? {}));
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

async function guildFeaturesCollection() {
  return (await getDb()).collection<{ _id: string; overrides?: Record<string, boolean> }>(
    GuildFeatures.collection,
  );
}

function parseGuildFeatures(raw: unknown): GuildFeaturesValue {
  const parsed = GuildFeatures.schema.safeParse(raw);
  return parsed.success ? parsed.data : { overrides: {} };
}

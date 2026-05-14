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
import { component } from "@/framework/component";

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

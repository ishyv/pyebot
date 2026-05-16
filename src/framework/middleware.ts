/**
 * Middleware — small helpers that sit between Discord's interaction stream
 * and the feature code. These do NOT live inside features because their job
 * is to enforce framework-level rules (feature enable/disable, admin checks,
 * error replies) before the feature ever runs.
 *
 * The middleware is plain functions, not a chain or pipeline — at this
 * scale, the "pipeline" pattern adds more reading than it removes. The
 * bootstrap calls these in order; each returns a verdict and the bootstrap
 * decides what to do next.
 */

import {
  type ChatInputCommandInteraction,
  type Interaction,
  PermissionFlagsBits,
} from "discord.js";
import { GuildFeatures } from "@/components/guild-features";
import type { Ctx, FeatureDescriptor } from "./types";

/**
 * Resolve whether a feature is enabled for the given guild.
 * Falls back to `feature.defaultEnabled` (default true) when no per-guild
 * override has been written.
 */
export async function isFeatureEnabled(
  ctx: Ctx,
  guildId: string | null,
  feature: FeatureDescriptor,
): Promise<boolean> {
  if (!guildId) {
    // DMs and other non-guild contexts: feature is enabled iff defaultEnabled.
    return feature.defaultEnabled !== false;
  }
  const cfg = await ctx.get(guildId, GuildFeatures);
  const override = cfg?.overrides[feature.id];
  if (override !== undefined) return override;
  return feature.defaultEnabled !== false;
}

/**
 * Best-effort ephemeral reply that respects the deferred/replied state.
 * Used by the framework's error boundary in src/index.ts.
 */
export async function safeReply(interaction: Interaction, content: string): Promise<void> {
  if (!interaction.isRepliable()) return;
  try {
    const ix = interaction as ChatInputCommandInteraction;
    if (ix.replied || ix.deferred) {
      await ix.followUp({ content, ephemeral: true });
    } else {
      await ix.reply({ content, ephemeral: true });
    }
  } catch {
    // best-effort
  }
}

/**
 * Verify the calling member has ManageGuild permission. Used to gate the
 * auto-generated /features command (enabling/disabling features should be
 * an admin action).
 */
export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.memberPermissions;
  if (!member) return false;
  return member.has(PermissionFlagsBits.ManageGuild);
}

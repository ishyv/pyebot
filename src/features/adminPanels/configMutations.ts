/**
 * Shared mutation boundary for Discord admin panels and the embedded webapp.
 *
 * These helpers encode the storage path each bot feature actually reads. UI
 * entrypoints should validate input, then call this module instead of choosing
 * Mongo paths locally.
 */

import { GuildEconomy, type GuildEconomyValue } from "@/components/guild-economy";
import { setGuildFeatureOverride, setGuildFeatureOverrides } from "@/components/guild-features";
import { getDb } from "@/core/db";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import type {
  AutomodSettingsPatch,
  EconomyPatch,
  ModerationSettingsPatch,
  RolePolicyPatch,
} from "@/webapp/bridge-types";

/** Converts a partial object into Mongo dot-path updates under `prefix`. */
export function flattenConfigPatch(
  prefix: string,
  value: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  if (!value) return paths;
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) paths[`${prefix}.${key}`] = entry;
  }
  return paths;
}

/** Applies legacy guild-document config paths used by moderation/automod/etc. */
export function applyGuildConfigPaths(
  guildId: string,
  paths: Record<string, unknown>,
  options: Parameters<typeof updateGuildPaths>[2] = { upsert: true },
): Promise<Result<void>> {
  return updateGuildPaths(guildId, paths, options);
}

/** Saves core channel slots on the guild config document read by bot services. */
export function saveChannelSettings(
  guildId: string,
  slots: Record<string, string | null>,
): Promise<Result<void>> {
  const paths: Record<string, unknown> = {};
  for (const [slot, channelId] of Object.entries(slots)) {
    paths[`channels.core.${slot}`] = channelId ? { channelId } : null;
  }
  return applyGuildConfigPaths(guildId, paths);
}

/** Saves moderation settings on the guild config document read by moderation services. */
export function saveModerationSettings(
  guildId: string,
  patch: ModerationSettingsPatch,
): Promise<Result<void>> {
  const paths: Record<string, unknown> = {};
  if (patch.modLogChannelId !== undefined) {
    paths["channels.core.modlog"] = patch.modLogChannelId
      ? { channelId: patch.modLogChannelId }
      : null;
  }
  if (patch.appealsChannelId !== undefined) {
    paths["moderation.appealsChannelId"] = patch.appealsChannelId;
  }
  if (patch.quarantineRoleId !== undefined) {
    paths["moderation.quarantine.roleId"] = patch.quarantineRoleId;
    paths["moderation.quarantine.enabled"] = patch.quarantineRoleId !== null;
  }
  if (patch.verifiedRoleId !== undefined) {
    paths["moderation.verification.roleId"] = patch.verifiedRoleId;
    paths["moderation.verification.enabled"] = patch.verifiedRoleId !== null;
  }
  return applyGuildConfigPaths(guildId, paths);
}

/** Saves automod settings on the guild config document read by automod services. */
export function saveAutomodSettings(
  guildId: string,
  patch: AutomodSettingsPatch,
): Promise<Result<void>> {
  return applyGuildConfigPaths(guildId, {
    ...flattenConfigPatch("automod.linkSpam", patch.linkSpam),
    ...flattenConfigPatch("automod.mentionSpam", patch.mentionSpam),
  });
}

/** Saves economy command settings on the GuildEconomy component the commands read. */
export async function saveEconomySettings(
  guildId: string,
  patch: EconomyPatch,
): Promise<Result<void>> {
  const paths = {
    ...flattenConfigPatch("daily", patch.daily),
    ...flattenConfigPatch("work", patch.work),
    ...flattenConfigPatch("sectors", patch.sectors),
  };
  try {
    const db = await getDb();
    await db.collection<{ _id: string }>(GuildEconomy.collection).findOneAndUpdate(
      { _id: guildId },
      {
        $setOnInsert: { _id: guildId },
        $set: { ...paths, updatedAt: new Date() },
      },
      { upsert: true, returnDocument: "after" },
    );
    return OkResult(undefined);
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Loads economy command settings from the GuildEconomy component with schema defaults. */
export async function loadEconomySettings(guildId: string): Promise<Result<GuildEconomyValue>> {
  try {
    const db = await getDb();
    const raw = await db.collection<{ _id: string }>(GuildEconomy.collection).findOne({
      _id: guildId,
    });
    const parsed = GuildEconomy.schema.safeParse(raw ?? {});
    return OkResult(parsed.success ? parsed.data : GuildEconomy.schema.parse({}));
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Saves one managed role policy after the caller has checked Discord permissions. */
export async function saveRolePolicySettings(
  guildId: string,
  patch: RolePolicyPatch,
): Promise<Result<void>> {
  const guildResult = await getGuild(guildId);
  if (guildResult.isErr()) return ErrResult(guildResult.error);
  const current = guildResult.unwrap()?.roles?.[patch.roleId] ?? {};
  const next = {
    ...current,
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.discordRoleId !== undefined ? { discordRoleId: patch.discordRoleId } : {}),
    ...(patch.reach !== undefined ? { reach: patch.reach } : {}),
    ...(patch.limits !== undefined ? { limits: patch.limits } : {}),
    updatedBy: patch.updatedBy ?? null,
    updatedAt: new Date().toISOString(),
  };
  return applyGuildConfigPaths(guildId, { [`roles.${patch.roleId}`]: next });
}

/** Saves one feature override on the GuildFeatures component. */
export function toggleFeatureSetting(
  guildId: string,
  featureId: string,
  enabled: boolean,
): ReturnType<typeof setGuildFeatureOverride> {
  return setGuildFeatureOverride(guildId, featureId, enabled);
}

/** Saves multiple feature overrides on the GuildFeatures component. */
export function setFeatureSettings(
  guildId: string,
  overrides: Readonly<Record<string, boolean>>,
): ReturnType<typeof setGuildFeatureOverrides> {
  return setGuildFeatureOverrides(guildId, overrides);
}

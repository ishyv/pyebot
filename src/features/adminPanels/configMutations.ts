/**
 * Shared mutation boundary for Discord admin panels and the embedded webapp.
 *
 * These helpers encode the storage path each bot feature actually reads. UI
 * entrypoints should validate input, then call this module instead of choosing
 * Mongo paths locally.
 */

import { setGuildFeatureOverride, setGuildFeatureOverrides } from "@/components/guild-features";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import { EconomyConfigSchema, type Guild as GuildConfig } from "@/db/schemas/guild";
import type {
  AutomodSettingsPatch,
  EconomyPatch,
  EconomyTaxPatch,
  ModerationSettingsPatch,
  RolePolicyPatch,
} from "@/webapp/bridge-types";

/** Converts a partial object into Mongo dot-path updates under `prefix`. */
export function flattenConfigPatch(
  prefix: string,
  value: Readonly<object> | undefined,
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  if (!value) return paths;
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) paths[`${prefix}.${key}`] = entry;
  }
  return paths;
}

/** Saves legacy guild-document economy tax settings read by tax-aware commands. */
export function saveEconomyTaxSettings(
  guildId: string,
  patch: EconomyTaxPatch,
): Promise<Result<void>> {
  return applyGuildConfigPaths(guildId, {
    ...flattenConfigPatch("economy.tax", patch),
  });
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
  const paths = {
    ...flattenConfigPatch("automod.linkSpam", patch.linkSpam),
    ...flattenConfigPatch("automod.domainWhitelist", patch.domainWhitelist),
    ...flattenConfigPatch("automod.crossChannelSpam", patch.crossChannelSpam),
    ...flattenConfigPatch("automod.mentionSpam", patch.mentionSpam),
    ...flattenConfigPatch("automod.slowmode", patch.slowmode),
    ...flattenConfigPatch("automod.raidDetection", patch.raidDetection),
    ...flattenConfigPatch("automod.perUserSlow", patch.perUserSlow),
    ...flattenConfigPatch("automod.imageDetection", patch.imageDetection),
    ...automodPolicyPaths(patch.policy),
    ...(patch.customPatterns !== undefined
      ? { "automod.customPatterns": patch.customPatterns }
      : {}),
    ...(patch.textRules !== undefined ? { "automod.textRules": patch.textRules } : {}),
  };
  return applyGuildConfigPaths(guildId, paths);
}

function automodPolicyPaths(
  policy: AutomodSettingsPatch["policy"] | undefined,
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  if (!policy) return paths;
  if (policy.preset !== undefined) paths["automod.policy.preset"] = policy.preset;
  if (policy.aiDetectorEnabled !== undefined) {
    paths["automod.policy.aiDetector.enabled"] = policy.aiDetectorEnabled;
  }
  if (policy.staffBypass !== undefined) {
    paths["automod.policy.bypass.staffBypass"] = policy.staffBypass;
  }
  if (policy.profileRetentionDays !== undefined) {
    paths["automod.policy.profileRetentionDays"] = policy.profileRetentionDays;
  }
  return paths;
}

/** Saves economy daily/work/sectors settings onto the guild document's economy slice. */
export function saveEconomySettings(guildId: string, patch: EconomyPatch): Promise<Result<void>> {
  return applyGuildConfigPaths(guildId, {
    ...flattenConfigPatch("economy.daily", patch.daily),
    ...flattenConfigPatch("economy.work", patch.work),
    ...flattenConfigPatch("economy.sectors", patch.sectors),
  });
}

/** Loads the guild document's economy config slice, with schema defaults when absent. */
export async function loadEconomySettings(
  guildId: string,
): Promise<Result<GuildConfig["economy"]>> {
  const res = await getGuild(guildId);
  if (res.isErr()) return ErrResult(res.error);
  return OkResult(res.unwrap()?.economy ?? EconomyConfigSchema.parse({}));
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

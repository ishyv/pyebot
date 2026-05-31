/**
 * AutoMod runtime handlers for raw Discord events and framework components.
 *
 * This class is discovered by the feature loader through the top-level
 * `handlers.ts` convention. It bridges three boundaries:
 * - raw Discord events via `@Listen` for high-volume message/member activity;
 * - framework events via `@On` for internal member-joined flow;
 * - component IDs via `@Handle` for raid alert buttons.
 *
 * Invariants:
 * - Message handling must fail closed to the handler, not the bot process.
 * - Temp-role grants are persisted before expiry sweeps can remove them.
 * - TTL indexes are intentionally not used for temp roles because expiry has
 *   Discord side effects: the role must be removed before the grant row is gone.
 */
import {
  type ButtonInteraction,
  type Client,
  Events,
  type GuildMember,
  type Message,
} from "discord.js";
import { TempRoleGrant, tempRoleGrantId } from "@/components/temp-role-grant";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import { MemberJoined } from "@/events/member-joined";
import { recordAutomodSystemCase } from "@/features/moderation/service";
import { Handle, Listen, On } from "@/framework";
import type { Ctx } from "@/framework/types";
import { detectAiClassificationSignals } from "./aiDetector";
import { detectBannedImageSignals } from "./bannedImages";
import { detectCrossChannelSpam } from "./crossChannelSpam";
import {
  handleRaidDismiss,
  handleRaidLockdown,
  RAID_DISMISS_PREFIX,
  RAID_LOCKDOWN_PREFIX,
} from "./handlers/raidAlert";
import { detectMentionSpam } from "./mentionSpam";
import {
  evaluatePerUserSlow,
  newlyAddedPerUserSlowRules,
  type PerUserSlowDecision,
  perUserSlowInputFromMessage,
} from "./perUserSlow";
import {
  applyAutomodDecision,
  detectMessageContentSignals,
  processAutomodSignals,
} from "./service";
import { checkSlowmode } from "./slowmode";
import {
  detectTempRolePolicySignals,
  directTempRoleDecision,
  shouldAssignTempRolePolicy,
  tempRoleTimeoutMs,
} from "./tempRolePolicy";

const EXPIRY_SWEEP_MS = 60_000;
const RECENTLY_JOINED_POLICY_ID = "recentlyJoined";
const PER_USER_SLOW_POLICY_PREFIX = "perUserSlow:";
const observedSlowGrantIds = new Set<string>();
const log = createLogger("automod:handlers");

export default class AutomodHandlers {
  private expiryTimer: ReturnType<typeof setInterval> | null = null;

  @Handle(RAID_LOCKDOWN_PREFIX)
  async onRaidLockdown(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    await handleRaidLockdown(interaction);
  }

  @Handle(RAID_DISMISS_PREFIX)
  async onRaidDismiss(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    await handleRaidDismiss(interaction);
  }

  @On(MemberJoined)
  async onMemberJoined(event: MemberJoined, ctx: Ctx): Promise<void> {
    const guildResult = await getGuild(event.guildId);
    const guildConfig = guildResult.isOk() ? guildResult.unwrap() : null;
    const policy = guildConfig?.automod.tempRolePolicies.recentlyJoined;
    if (!policy) return;

    const guild = await ctx.client.guilds.fetch(event.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(event.userId).catch(() => null) : null;
    if (!guild || !member) return;
    if (
      !shouldAssignTempRolePolicy(policy, {
        now: Date.now(),
        accountCreatedAt: member.user.createdTimestamp,
        roleIds: [...member.roles.cache.keys()],
      })
    ) {
      return;
    }

    const roleId = policy.roleId;
    if (!roleId) return;
    await grantTempRole(ctx, member, roleId, policy.durationSeconds);
  }

  @Listen("messageCreate")
  async onMessage(message: Message, ctx: Ctx): Promise<void> {
    try {
      if (message.author.bot || !message.guild) return;
      const guildResult = await getGuild(message.guild.id);
      const guild = guildResult.isOk() ? guildResult.unwrap() : null;
      if (!guild) return;

      const config = guild.automod;
      const slowInput = perUserSlowInputFromMessage(message);
      if (slowInput) {
        const slowDecision = evaluatePerUserSlow(config, slowInput);
        if (slowDecision.rule && message.member) {
          // WHY: per-user slow roles can be assigned outside this process. The
          // first matching message repairs the in-memory/persisted expiry state.
          await recoverPerUserSlowGrant(ctx, message.member, slowDecision.rule);
        }
        if (slowDecision.action !== "allow") {
          await applyPerUserSlowDecision(message, slowDecision);
          return;
        }
      }

      const tempPolicy = config.tempRolePolicies.recentlyJoined;
      const tempSignals = detectTempRolePolicySignals(message, tempPolicy);
      const tempDecision = directTempRoleDecision(tempSignals);
      if (tempDecision) {
        const result = await applyAutomodDecision(message, config, tempDecision, tempSignals, {
          reportChannelId: tempPolicy.reportChannelId,
          timeoutMs: tempRoleTimeoutMs(tempSignals),
        });
        if (result.action !== "report") {
          await checkSlowmode(message);
          return;
        }
      }

      const signals = [
        ...detectMessageContentSignals(message, config),
        ...detectCrossChannelSpam(message, config),
        ...detectMentionSpam(message, config),
        ...(await detectBannedImageSignals(message, config)),
        ...(await detectAiClassificationSignals(message, config)),
      ];
      await processAutomodSignals(message, config, signals);
      await checkSlowmode(message);
    } catch (error) {
      log.error("AutoMod message handler failed", error);
    }
  }

  @Listen(Events.GuildMemberUpdate)
  async onMemberUpdated(oldMember: GuildMember, newMember: GuildMember, ctx: Ctx): Promise<void> {
    const guildResult = await getGuild(newMember.guild.id);
    const guild = guildResult.isOk() ? guildResult.unwrap() : null;
    if (!guild) return;

    for (const rule of newlyAddedPerUserSlowRules(guild.automod, oldMember, newMember)) {
      await savePerUserSlowGrant(ctx, newMember, rule.roleId, rule.durationSeconds);
    }
  }

  @Listen(Events.ClientReady)
  onReady(_client: Client, ctx: Ctx): void {
    if (this.expiryTimer) return;
    // WHY: expiry is a sweep, not Mongo TTL. Deleting the DB row without first
    // removing the Discord role would strand temporary access on the member.
    this.expiryTimer = setInterval(() => {
      void sweepExpiredTempRoles(ctx).catch((error) => {
        log.error("Failed to sweep temp-role grants", error);
      });
    }, EXPIRY_SWEEP_MS);
  }
}

function perUserSlowPolicyId(roleId: string): string {
  return `${PER_USER_SLOW_POLICY_PREFIX}${roleId}`;
}

async function grantTempRole(
  ctx: Ctx,
  member: GuildMember,
  roleId: string,
  durationSeconds: number,
): Promise<void> {
  const role = await member.guild.roles.fetch(roleId).catch(() => null);
  if (!role || role.managed || !role.editable) {
    log.warn(`Skipping unmanaged temp role ${roleId} in ${member.guild.id}.`);
    return;
  }

  if (!member.roles.cache.has(roleId)) {
    // WHY: Discord role assignment is attempted before persistence so a stored
    // grant always represents a role this process tried to apply.
    await member.roles.add(roleId, "Recently joined temp-role policy").catch((error) => {
      log.error(`Failed to grant temp role ${roleId}`, error);
    });
  }

  await ctx.set(
    tempRoleGrantId(member.guild.id, member.id, RECENTLY_JOINED_POLICY_ID),
    TempRoleGrant,
    {
      guildId: member.guild.id,
      userId: member.id,
      policyId: RECENTLY_JOINED_POLICY_ID,
      roleId,
      expiresAt: new Date(Date.now() + durationSeconds * 1000),
      createdAt: new Date(),
    },
  );
}

async function savePerUserSlowGrant(
  ctx: Ctx,
  member: GuildMember,
  roleId: string,
  durationSeconds: number,
): Promise<void> {
  if (!roleId || !member.roles.cache.has(roleId)) return;
  const grantId = tempRoleGrantId(member.guild.id, member.id, perUserSlowPolicyId(roleId));
  observedSlowGrantIds.add(grantId);
  await ctx.set(grantId, TempRoleGrant, {
    guildId: member.guild.id,
    userId: member.id,
    policyId: perUserSlowPolicyId(roleId),
    roleId,
    expiresAt: new Date(Date.now() + durationSeconds * 1000),
    createdAt: new Date(),
  });
}

async function recoverPerUserSlowGrant(
  ctx: Ctx,
  member: GuildMember,
  rule: { readonly roleId: string; readonly durationSeconds: number },
): Promise<void> {
  const grantId = tempRoleGrantId(member.guild.id, member.id, perUserSlowPolicyId(rule.roleId));
  if (observedSlowGrantIds.has(grantId)) return;
  observedSlowGrantIds.add(grantId);
  const existing = await ctx.get(grantId, TempRoleGrant);
  if (existing) return;
  await savePerUserSlowGrant(ctx, member, rule.roleId, rule.durationSeconds);
}

async function applyPerUserSlowDecision(
  message: Message,
  decision: Exclude<PerUserSlowDecision, { readonly action: "allow" }>,
): Promise<void> {
  await message.delete().catch(() => {});

  const retryAt = Math.ceil(decision.cooldownEndsAt / 1000);
  const reason = `Per-user slow role cooldown (${decision.rule.cooldownSeconds}s)`;
  if (decision.action === "warn") {
    await message.author
      .send(
        `Your message in ${message.guild?.name ?? "the server"} was removed because you are on a per-user slow cooldown. Wait until <t:${retryAt}:R> before posting again. If you post again before then, you will be timed out.`,
      )
      .catch(() => {});
  }

  if (decision.action === "timeout" && message.guild && message.member) {
    const durationMs = decision.rule.cooldownSeconds * 1000;
    await message.member.timeout(durationMs, reason).catch((error) => {
      log.error("Failed to apply per-user slow timeout", error);
    });
    await recordAutomodSystemCase(
      message.guild,
      message.member,
      "TIMEOUT",
      reason,
      `Per-user slow role <@&${decision.rule.roleId}> violation ${decision.violations}.`,
    ).catch((error) => log.error("Failed to record per-user slow timeout case", error));
  }
}

async function sweepExpiredTempRoles(ctx: Ctx): Promise<void> {
  const grants = await ctx.query(TempRoleGrant, { filter: { expiresAt: { $lte: new Date() } } });
  for (const grant of grants) {
    const guild = await ctx.client.guilds.fetch(grant.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(grant.userId).catch(() => null) : null;
    if (member?.roles.cache.has(grant.roleId)) {
      const reason = grant.policyId.startsWith(PER_USER_SLOW_POLICY_PREFIX)
        ? "Per-user slow role expired"
        : "Recently joined temp role expired";
      // RISK: this remove can fail because of Discord permissions or deleted
      // roles. The grant row is still deleted so the sweeper does not retry
      // forever on an unfixable guild configuration.
      await member.roles.remove(grant.roleId, reason).catch((error) => {
        log.error(`Failed to remove expired temp role ${grant.roleId}`, error);
      });
    }
    observedSlowGrantIds.delete(grant._id);
    await ctx.delete(grant._id, TempRoleGrant);
  }
}

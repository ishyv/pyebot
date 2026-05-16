import { type Client, Events, type GuildMember, type Message } from "discord.js";
import { TempRoleGrant, tempRoleGrantId } from "@/components/temp-role-grant";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import { MemberJoined } from "@/events/member-joined";
import { Listen, On } from "@/framework";
import type { Ctx } from "@/framework/types";
import { detectAiClassificationSignals } from "./aiDetector";
import { detectCrossChannelSpam } from "./crossChannelSpam";
import { detectMentionSpam } from "./mentionSpam";
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
const log = createLogger("automod:handlers");

export default class AutomodHandlers {
  private expiryTimer: ReturnType<typeof setInterval> | null = null;

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

    await grantTempRole(ctx, member, policy.roleId!, policy.durationSeconds);
  }

  @Listen("messageCreate")
  async onMessage(message: Message, _ctx: Ctx): Promise<void> {
    try {
      if (message.author.bot || !message.guild) return;
      const guildResult = await getGuild(message.guild.id);
      const guild = guildResult.isOk() ? guildResult.unwrap() : null;
      if (!guild) return;

      const config = guild.automod;
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
        ...(await detectAiClassificationSignals(message, config)),
      ];
      await processAutomodSignals(message, config, signals);
      await checkSlowmode(message);
    } catch (error) {
      log.error("AutoMod message handler failed", error);
    }
  }

  @Listen(Events.ClientReady)
  onReady(_client: Client, ctx: Ctx): void {
    if (this.expiryTimer) return;
    this.expiryTimer = setInterval(() => {
      void sweepExpiredTempRoles(ctx).catch((error) => {
        log.error("Failed to sweep temp-role grants", error);
      });
    }, EXPIRY_SWEEP_MS);
  }
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

async function sweepExpiredTempRoles(ctx: Ctx): Promise<void> {
  const grants = await ctx.query(TempRoleGrant, { filter: { expiresAt: { $lte: new Date() } } });
  for (const grant of grants) {
    const guild = await ctx.client.guilds.fetch(grant.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(grant.userId).catch(() => null) : null;
    if (member?.roles.cache.has(grant.roleId)) {
      await member.roles
        .remove(grant.roleId, "Recently joined temp role expired")
        .catch((error) => {
          log.error(`Failed to remove expired temp role ${grant.roleId}`, error);
        });
    }
    await ctx.delete(grant._id, TempRoleGrant);
  }
}

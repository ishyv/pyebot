import {
  type ButtonInteraction,
  type Client,
  Events,
  type GuildMember,
  type Message,
  MessageFlags,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import {
  AutoroleRule,
  type AutoroleRuleValue,
  autoroleRuleId,
  TimedAutoroleGrant,
} from "@/components/autorole-rule";
import { MemberJoined } from "@/events/member-joined";
import { Handle, Listen, On } from "@/framework";
import type { Ctx } from "@/framework/types";
import {
  AUTOROLE_TOGGLE_PREFIX,
  findButtonRules,
  findJoinRules,
  findMessageRules,
  findReactRules,
  reactionEmojiKey,
  timedGrantId,
} from "./rules";

const EXPIRY_SWEEP_MS = 60_000;

export default class AutoroleHandlers {
  private expiryTimer: ReturnType<typeof setInterval> | null = null;

  @On(MemberJoined)
  async onMemberJoined(event: MemberJoined, ctx: Ctx): Promise<void> {
    const guild = await ctx.client.guilds.fetch(event.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(event.userId).catch(() => null) : null;
    if (!guild || !member) return;
    await applyRules(ctx, member, findJoinRules(await guildRules(ctx, event.guildId)));
  }

  @Listen("messageReactionAdd")
  async onReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    ctx: Ctx,
  ): Promise<void> {
    if (user.bot) return;
    const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
    const guild = fullReaction?.message.guild;
    if (!fullReaction || !guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const rules = findReactRules(
      await guildRules(ctx, guild.id),
      fullReaction.message.id,
      reactionEmojiKey(fullReaction),
    );
    await applyRules(ctx, member, rules);
  }

  @Listen("messageReactionRemove")
  async onReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    ctx: Ctx,
  ): Promise<void> {
    if (user.bot) return;
    const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
    const guild = fullReaction?.message.guild;
    if (!fullReaction || !guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const rules = findReactRules(
      await guildRules(ctx, guild.id),
      fullReaction.message.id,
      reactionEmojiKey(fullReaction),
    );
    await revokeRules(ctx, member, rules);
  }

  @Listen("messageCreate")
  async onMessage(message: Message, ctx: Ctx): Promise<void> {
    if (message.author.bot || !message.guild) return;
    const member =
      message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;
    await applyRules(
      ctx,
      member,
      findMessageRules(await guildRules(ctx, message.guild.id), message.content),
    );
  }

  @Handle(AUTOROLE_TOGGLE_PREFIX)
  async onButton(interaction: ButtonInteraction, ctx: Ctx): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Use this in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "Could not resolve your server member.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const rules = findButtonRules(
      await guildRules(ctx, interaction.guild.id),
      interaction.customId,
    );
    if (rules.length === 0) {
      await interaction.reply({
        content: "That autorole button is no longer active.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasRole = member.roles.cache.has(rules[0]!.roleId);
    if (hasRole) {
      await revokeRules(ctx, member, rules);
      await interaction.reply({ content: "Role removed.", flags: MessageFlags.Ephemeral });
      return;
    }

    await applyRules(ctx, member, rules);
    await interaction.reply({ content: "Role added.", flags: MessageFlags.Ephemeral });
  }

  @Listen(Events.ClientReady)
  onReady(_client: Client, ctx: Ctx): void {
    if (this.expiryTimer) return;
    this.expiryTimer = setInterval(() => {
      void sweepExpiredGrants(ctx).catch((error) => {
        ctx.logger.error("Failed to sweep expired autoroles", error);
      });
    }, EXPIRY_SWEEP_MS);
  }
}

async function guildRules(ctx: Ctx, guildId: string): Promise<readonly AutoroleRuleValue[]> {
  return ctx.query(AutoroleRule, { filter: { guildId } });
}

async function applyRules(
  ctx: Ctx,
  member: GuildMember,
  rules: readonly AutoroleRuleValue[],
): Promise<void> {
  for (const rule of rules) {
    if (member.roles.cache.has(rule.roleId)) {
      await scheduleTimedGrant(ctx, member, rule);
      continue;
    }
    const role = await member.guild.roles.fetch(rule.roleId).catch(() => null);
    if (!role || role.managed || !role.editable) {
      ctx.logger.warn(`Skipping unmanaged autorole ${rule.name} (${rule.roleId}).`);
      continue;
    }
    await member.roles.add(rule.roleId, `autorole:${rule.name}`).catch((error) => {
      ctx.logger.error(`Failed to grant autorole ${rule.name}`, error);
    });
    await scheduleTimedGrant(ctx, member, rule);
  }
}

async function revokeRules(
  ctx: Ctx,
  member: GuildMember,
  rules: readonly AutoroleRuleValue[],
): Promise<void> {
  for (const rule of rules) {
    if (!member.roles.cache.has(rule.roleId)) continue;
    const role = await member.guild.roles.fetch(rule.roleId).catch(() => null);
    if (!role || role.managed || !role.editable) continue;
    await member.roles.remove(rule.roleId, `autorole:${rule.name}`).catch((error) => {
      ctx.logger.error(`Failed to remove autorole ${rule.name}`, error);
    });
    await ctx.delete(
      timedGrantId(
        member.guild.id,
        member.id,
        rule.roleId,
        autoroleRuleId(member.guild.id, rule.name),
      ),
      TimedAutoroleGrant,
    );
  }
}

async function scheduleTimedGrant(
  ctx: Ctx,
  member: GuildMember,
  rule: AutoroleRuleValue,
): Promise<void> {
  if (!rule.durationMs) return;
  const ruleId = autoroleRuleId(member.guild.id, rule.name);
  await ctx.set(timedGrantId(member.guild.id, member.id, rule.roleId, ruleId), TimedAutoroleGrant, {
    guildId: member.guild.id,
    userId: member.id,
    roleId: rule.roleId,
    ruleId,
    expiresAt: new Date(Date.now() + rule.durationMs),
  });
}

async function sweepExpiredGrants(ctx: Ctx): Promise<void> {
  const grants = await ctx.query(TimedAutoroleGrant, {
    filter: { expiresAt: { $lte: new Date() } },
  });
  for (const grant of grants) {
    const guild = await ctx.client.guilds.fetch(grant.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(grant.userId).catch(() => null) : null;
    if (member?.roles.cache.has(grant.roleId)) {
      await member.roles.remove(grant.roleId, "autorole expired").catch((error) => {
        ctx.logger.error(`Failed to expire autorole ${grant.roleId}`, error);
      });
    }
    await ctx.delete(grant._id, TimedAutoroleGrant);
  }
}

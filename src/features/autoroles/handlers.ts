import { type GuildMember, MessageFlags } from "discord.js";
import {
  AutoroleRule,
  type AutoroleRuleValue,
  autoroleRuleId,
  TimedAutoroleGrant,
} from "@/components/autorole-rule";
import { MemberJoined } from "@/events/member-joined";
import { defineHandlers, listen, on, routeHandlers } from "@/framework";
import type { Ctx } from "@/framework/types";
import { routes } from "./routes";
import {
  findButtonRules,
  findJoinRules,
  findMessageRules,
  findReactRules,
  reactionEmojiKey,
  timedGrantId,
} from "./rules";

const EXPIRY_SWEEP_MS = 60_000;
// Per-feature state that the handler class used to hold as an instance field is
// now a module-level closure — simpler, and there is exactly one bot per process.
let expiryTimer: ReturnType<typeof setInterval> | null = null;

export default defineHandlers([
  on(MemberJoined, async (event, ctx) => {
    const guild = await ctx.client.guilds.fetch(event.guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(event.userId).catch(() => null) : null;
    if (!guild || !member) return;
    await applyRules(ctx, member, findJoinRules(await guildRules(ctx, event.guildId)));
  }),

  // discord.js v14 emits a third `details` arg on reaction events; `ctx` is last.
  listen("messageReactionAdd", async (reaction, user, _details, ctx) => {
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
  }),

  listen("messageReactionRemove", async (reaction, user, _details, ctx) => {
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
  }),

  listen("messageCreate", async (message, ctx) => {
    if (message.author.bot || !message.guild) return;
    const member =
      message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;
    await applyRules(
      ctx,
      member,
      findMessageRules(await guildRules(ctx, message.guild.id), message.content),
    );
  }),

  ...routeHandlers(routes, {
    // args: { message, role } — decoded from the toggle button's customId.
    toggle: async (interaction, args, ctx) => {
      if (!interaction.guild) {
        await interaction.reply({
          content: "Use this in a server.",
          flags: MessageFlags.Ephemeral,
        });
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
        args.message,
        args.role,
      );
      if (rules.length === 0) {
        await interaction.reply({
          content: "That autorole button is no longer active.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const primaryRoleId = rules[0]?.roleId;
      if (!primaryRoleId) return;
      if (member.roles.cache.has(primaryRoleId)) {
        await revokeRules(ctx, member, rules);
        await interaction.reply({ content: "Role removed.", flags: MessageFlags.Ephemeral });
        return;
      }
      await applyRules(ctx, member, rules);
      await interaction.reply({ content: "Role added.", flags: MessageFlags.Ephemeral });
    },
  }),

  listen("clientReady", (_client, ctx) => {
    if (expiryTimer) return;
    expiryTimer = setInterval(() => {
      void sweepExpiredGrants(ctx).catch((error) => {
        ctx.logger.error("Failed to sweep expired autoroles", error);
      });
    }, EXPIRY_SWEEP_MS);
  }),
]);

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

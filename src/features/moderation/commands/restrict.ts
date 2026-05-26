import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { restrict } from "@/features/moderation/service";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { sendModLog } from "../modlog";
import { dmUser } from "../notifications";
import { renderModlogCase } from "../views";

const data = new SlashCommandBuilder()
  .setName("restrict")
  .setDescription("Restrict a member from specific server areas")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Member to restrict").setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("Area to restrict from")
      .setRequired(true)
      .addChoices(
        { name: "Forums", value: "forums" },
        { name: "Voice", value: "voice" },
        { name: "Jobs", value: "jobs" },
        { name: "All areas", value: "all" },
      ),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for restriction").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild || !interaction.member) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const guild = interaction.guild;
  const targetUser = interaction.options.getUser("user", true);
  const type = interaction.options.getString("type", true) as "forums" | "voice" | "jobs" | "all";
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  // Fetch guild config and get restriction role
  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr()) {
    await ctx.respond.send({ content: "Failed to load guild configuration." });
    return;
  }

  const guildData = guildResult.unwrap();
  const roleId = guildData?.moderation.restrictionRoles[type] ?? null;

  if (!roleId) {
    await ctx.respond.send({
      content:
        "Restriction roles are not configured. Use `/modconfig restrict-roles` to set them up.",
    });
    return;
  }

  // Verify the role exists in Discord
  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await ctx.respond.send({
      content:
        "The configured restriction role no longer exists. Please reconfigure it with `/modconfig restrict-roles`.",
    });
    return;
  }

  // Check role hierarchy — bot's highest role must be above the restriction role
  const botMember = guild.members.me;
  if (!botMember) {
    await ctx.respond.send({ content: "Unable to determine bot permissions." });
    return;
  }
  if (botMember.roles.highest.position <= role.position) {
    await ctx.respond.send({
      content: "Cannot assign a role higher than or equal to the bot's highest role.",
    });
    return;
  }

  // Fetch target member
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    await ctx.respond.send({ content: "That user is not a member of this server." });
    return;
  }

  // Fetch moderator member
  const moderator = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!moderator) {
    await ctx.respond.send({ content: "Unable to verify your server membership." });
    return;
  }

  // Execute restriction
  const result = await restrict(guild, moderator, targetMember, type, roleId, reason);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Failed: ${result.error.message}` });
    return;
  }

  const sanctionResult = result.unwrap();

  await dmUser(targetMember.user, "RESTRICT", guild.name, reason, sanctionResult.caseId);
  await sendModLog(guild, sanctionResult, { restrictionType: type });

  await ctx.respond.send(
    renderModlogCase({ result: sanctionResult, extras: { restrictionType: type } }),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

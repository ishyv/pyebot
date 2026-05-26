import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { kick } from "@/features/moderation/service";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { sendModLog } from "../modlog";
import { dmUser } from "../notifications";
import { renderModlogCase } from "../views";

const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a member from the server")
  .addUserOption((opt) => opt.setName("user").setDescription("Member to kick").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the kick").setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await ctx.respond.send({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);

  await ctx.respond.defer({ visibility: "ephemeral" });

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await ctx.respond.send({ content: "That user is not a member of this server." });
    return;
  }

  const result = await kick(interaction.guild, moderator, targetMember, reason);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Failed: ${result.error.message}` });
    return;
  }

  const sanctionResult = result.unwrap();

  await dmUser(targetMember.user, "KICK", interaction.guild.name, reason, sanctionResult.caseId);
  await sendModLog(interaction.guild, sanctionResult);

  await ctx.respond.send(renderModlogCase({ result: sanctionResult }));
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

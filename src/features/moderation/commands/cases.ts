import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getCases } from "@/features/moderation/service";
import { renderSanctionHistory } from "@/features/moderation/views";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { hasPermission } from "@/middleware/permissions";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("cases")
  .setDescription("View the sanction history of a user on this server")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to look up (defaults to yourself)").setRequired(false),
  )
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await ctx.respond.send({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user") ?? interaction.user;

  await ctx.respond.defer({ visibility: "ephemeral" });

  // Privacy gate: only allow viewing other users' history if caller has ModerateMembers
  const isSelf = targetUser.id === interaction.user.id;
  if (!isSelf) {
    const callerMember = await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => null);
    if (!callerMember || !hasPermission(callerMember, PermissionFlagsBits.ModerateMembers)) {
      await ctx.respond.send(
        v2Message(
          container(
            "danger",
            text("**Permission denied.** You can only view your own case history."),
          ),
        ),
      );
      return;
    }
  }

  const result = await getCases(targetUser.id, interaction.guild.id);

  if (result.isErr()) {
    await ctx.respond.send({ content: "Failed to fetch case history." });
    return;
  }

  const history = result.unwrap();

  if (history.length === 0) {
    await ctx.respond.send({
      content: `**${targetUser.tag}** has no cases recorded on this server.`,
    });
    return;
  }

  // Most recent first, cap at 15
  const entries = [...history].reverse().slice(0, 15);

  await ctx.respond.send(renderSanctionHistory(targetUser.tag, entries));
}

export default defineCommand({
  data,
  help: { hints: [] },
  execute,
});

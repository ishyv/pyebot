import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { quarantine, release } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { defineCommand } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("quarantine")
  .setDescription("Quarantine or release a member")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Place a member in quarantine")
      .addUserOption((o) =>
        o.setName("user").setDescription("Member to quarantine").setRequired(true),
      )
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("release")
      .setDescription("Release a member from quarantine, restoring their roles")
      .addUserOption((o) =>
        o.setName("user").setDescription("Member to release").setRequired(true),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("user", true);

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await interaction.editReply({ content: "That user is not a member of this server." });
    return;
  }

  if (sub === "add") {
    const reason = interaction.options.getString("reason", true);
    const result = await quarantine(interaction.guild, moderator, targetMember, reason);

    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }

    await interaction.editReply(renderModlogCase({ result: result.unwrap() }));
    return;
  }

  if (sub === "release") {
    const result = await release(interaction.guild, moderator, targetMember);

    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }

    const { restoredRoles } = result.unwrap();
    await interaction.editReply(
      v2Message(
        container(
          "ok",
          text(
            `**${targetUser.tag}** released from quarantine.\n**Roles restored:** ${restoredRoles}`,
          ),
        ),
      ),
    );
  }
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

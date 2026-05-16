import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { ban, TEMP_BAN_DURATION_CHOICES } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { defineCommand } from "@/framework";

const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user from the server")
  .addUserOption((opt) => opt.setName("user").setDescription("User to ban").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the ban").setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Temporary ban duration (omit for permanent)")
      .addChoices(...TEMP_BAN_DURATION_CHOICES.map((d) => ({ name: d, value: d }))),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);
  const duration = interaction.options.getString("duration") ?? undefined;
  const moderator = await interaction.guild.members.fetch(interaction.user.id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await ban(interaction.guild, moderator, target, reason, duration);

  if (result.isErr()) {
    await interaction.editReply({ content: `Failed: ${result.error.message}` });
    return;
  }

  const modResult = result.unwrap();
  await interaction.editReply(
    renderModlogCase({ result: modResult, extras: duration ? { duration } : undefined }),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { unban } from "@/features/moderation/service";
import { defineCommand } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { sendModLog } from "../modlog";
import { renderModlogCase } from "../views";

const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Unban a user from this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt.setName("user_id").setDescription("Discord user ID of the banned user").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for unbanning").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild || !interaction.member) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.options.getString("user_id", true).trim();
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!/^\d{17,19}$/.test(userId)) {
    await interaction.editReply(
      v2Message(
        container(
          "danger",
          text("**Invalid user ID.** Please provide a valid Discord snowflake (17–19 digits)."),
        ),
      ),
    );
    return;
  }

  try {
    await interaction.guild.bans.fetch(userId);
  } catch {
    await interaction.editReply(
      v2Message(container("danger", text("That user is not currently banned."))),
    );
    return;
  }

  const moderator = await interaction.guild.members.fetch(interaction.user.id);

  const targetUser = await interaction.guild.client.users.fetch(userId).catch(() => null);
  const result = await unban(interaction.guild, moderator, userId, reason, targetUser?.tag);

  if (result.isErr()) {
    await interaction.editReply(
      v2Message(container("danger", text(`**Failed:** ${result.error.message}`))),
    );
    return;
  }

  const sanctionResult = result.unwrap();

  await sendModLog(interaction.guild, sanctionResult);

  await interaction.editReply(renderModlogCase({ result: sanctionResult }));
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

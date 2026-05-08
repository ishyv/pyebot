import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { initiateFight } from "@/features/rpg/combat/fight";

export const data = new SlashCommandBuilder()
  .setName("fight")
  .setDescription("Challenge another user to a fight")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to challenge").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const userId = interaction.user.id;

  if (target.id === userId) {
    await interaction.editReply({ content: "You cannot challenge yourself to a fight." });
    return;
  }

  const result = await initiateFight(userId, target.id);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { sessionId, expiresAt } = result.unwrap();
  const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle("Fight Invitation Sent!")
    .setDescription(
      `Fight invitation sent to <@${target.id}>!\n\nExpires <t:${expiryTimestamp}:R>`,
    );

  const acceptButton = new ButtonBuilder()
    .setCustomId(`fight_accept:${sessionId}`)
    .setLabel("Accept")
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButton);

  await interaction.editReply({ embeds: [embed], components: [row] });
}

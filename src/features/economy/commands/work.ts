import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { work, WorkError } from "@/features/economy/work";

export const data = new SlashCommandBuilder()
  .setName("work")
  .setDescription("Work to earn coins");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const result = await work(interaction.user.id);

  if (result.isErr()) {
    if (result.error instanceof WorkError && result.error.code === "ON_COOLDOWN") {
      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("On Cooldown")
        .setDescription(result.error.message);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { payout, currencyId } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Work Complete")
    .setDescription(`Earned **${payout} ${currencyId}**`);

  await interaction.editReply({ embeds: [embed] });
}

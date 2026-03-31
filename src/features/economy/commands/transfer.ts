import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { transfer } from "@/features/economy/mutations";

export const data = new SlashCommandBuilder()
  .setName("transfer")
  .setDescription("Transfer coins to another user")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Recipient").setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt.setName("amount").setDescription("Amount to transfer").setRequired(true).setMinValue(1),
  )
  .addStringOption((opt) =>
    opt
      .setName("currency")
      .setDescription("Currency to transfer (default: coins)")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const recipient = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);
  const currencyId = interaction.options.getString("currency") ?? "coins";
  const senderId = interaction.user.id;

  const result = await transfer(senderId, recipient.id, currencyId, amount);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("Transfer Successful")
    .setDescription(`Transferred **${amount} ${currencyId}** to <@${recipient.id}>`);

  await interaction.editReply({ embeds: [embed] });
}

import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { transfer, getBalance } from "@/features/economy/mutations";
import { coins } from "@/utils/fmt";

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

  // Record sender balance before
  const beforeRes = await getBalance(senderId, currencyId);
  const beforeBalance = beforeRes.isOk() ? beforeRes.unwrap() : 0;

  const result = await transfer(senderId, recipient.id, currencyId, amount);

  if (result.isErr()) {
    const errEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("❌ Transfer Failed")
      .setDescription(result.error.message);
    await interaction.editReply({ embeds: [errEmbed] });
    return;
  }

  const { senderBalance, recipientBalance } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("💸 Transfer Sent")
    .addFields(
      {
        name: "💰 Your Balance",
        value: `${coins(beforeBalance, currencyId)} → ${coins(senderBalance, currencyId)}`,
        inline: true,
      },
      {
        name: "📤 Sent",
        value: coins(amount, currencyId),
        inline: true,
      },
      {
        name: "📥 Recipient",
        value: `<@${recipient.id}> now has ${coins(recipientBalance, currencyId)}`,
        inline: false,
      },
    )
    .setFooter({ text: "💡 /balance • /bank" });

  await interaction.editReply({ embeds: [embed] });
}

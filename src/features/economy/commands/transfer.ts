import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { transfer, getBalance, MutationError } from "@/features/economy/mutations";
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

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const recipient = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);
  const currencyId = interaction.options.getString("currency") ?? "coins";
  const senderId = interaction.user.id;

  const beforeBalance = await getBalance(ctx, senderId, currencyId);

  try {
    const { senderBalance, recipientBalance } = await transfer(ctx, senderId, recipient.id, currencyId, amount);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle("💸 Transfer Sent")
      .addFields(
        {
          name: "💰 Your Balance",
          value: `${coins(beforeBalance, currencyId)} → ${coins(senderBalance, currencyId)}`,
          inline: true,
        },
        { name: "📤 Sent", value: coins(amount, currencyId), inline: true },
        {
          name: "📥 Recipient",
          value: `<@${recipient.id}> now has ${coins(recipientBalance, currencyId)}`,
          inline: false,
        },
      )
      .setFooter({ text: "💡 /balance • /bank" });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = err instanceof MutationError ? err.message : "An error occurred.";
    const errEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("❌ Transfer Failed")
      .setDescription(msg);
    await interaction.editReply({ embeds: [errEmbed] });
  }
}

import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getBalance, MutationError, transfer } from "@/features/economy/mutations";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

const data = new SlashCommandBuilder()
  .setName("transfer")
  .setDescription("Transfer coins to another user")
  .addUserOption((opt) => opt.setName("user").setDescription("Recipient").setRequired(true))
  .addIntegerOption((opt) =>
    opt.setName("amount").setDescription("Amount to transfer").setRequired(true).setMinValue(1),
  )
  .addStringOption((opt) =>
    opt
      .setName("currency")
      .setDescription("Currency to transfer (default: coins)")
      .setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
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
    const { senderBalance, recipientBalance } = await transfer(
      ctx,
      senderId,
      recipient.id,
      currencyId,
      amount,
    );

    await interaction.editReply(
      v2Message(
        container(
          "ok",
          text(
            `## 💸 Transfer Sent\n💰 **Your Balance:** ${coins(beforeBalance, currencyId)} → ${coins(senderBalance, currencyId)}\n📤 **Sent:** ${coins(amount, currencyId)}\n📥 **Recipient:** <@${recipient.id}> now has ${coins(recipientBalance, currencyId)}\n\n-# 💡 /balance • /bank`,
          ),
        ),
      ),
    );
  } catch (err) {
    const msg = err instanceof MutationError ? err.message : "An error occurred.";
    await interaction.editReply(
      v2Message(container("danger", text(`## ❌ Transfer Failed\n${msg}`))),
    );
  }
}

export default defineCommand({
  data,
  help: { hints: ["/balance"] },
  execute,
});

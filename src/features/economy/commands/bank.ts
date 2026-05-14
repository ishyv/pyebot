import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { ensureAccount } from "@/features/economy/account";
import { getBalance, getBankBalance, deposit, withdraw, MutationError } from "@/features/economy/mutations";
import { UserCurrency } from "@/components/user-currency";
import { coins } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
  .setName("bank")
  .setDescription("Manage your bank account")
  .addSubcommand((sub) =>
    sub.setName("balance").setDescription("View your hand and bank balance"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("deposit")
      .setDescription("Deposit coins into your bank (safe from /rob)")
      .addIntegerOption((o) =>
        o.setName("amount").setDescription("Amount to deposit").setRequired(true).setMinValue(1),
      )
      .addStringOption((o) =>
        o.setName("currency").setDescription("Currency (default: coins)"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("withdraw")
      .setDescription("Withdraw coins from your bank")
      .addIntegerOption((o) =>
        o.setName("amount").setDescription("Amount to withdraw").setRequired(true).setMinValue(1),
      )
      .addStringOption((o) =>
        o.setName("currency").setDescription("Currency (default: coins)"),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "balance") await handleBalance(interaction, ctx);
  else if (sub === "deposit") await handleDeposit(interaction, ctx);
  else if (sub === "withdraw") await handleWithdraw(interaction, ctx);
}

async function handleBalance(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const userId = interaction.user.id;
  await ensureAccount(ctx, userId);

  const wallet = await ctx.get(userId, UserCurrency);
  const balances = wallet?.balances ?? {};
  const bankBalances = wallet?.bankBalances ?? {};

  const allKeys = new Set([...Object.keys(balances), ...Object.keys(bankBalances)]);
  const entries = [...allKeys].filter((k) => (balances[k] ?? 0) > 0 || (bankBalances[k] ?? 0) > 0);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("🏦 Bank Account")
    .setFooter({ text: "💡 Bank funds are safe from /rob" });

  if (entries.length === 0) {
    embed.setDescription("No currencies yet. Use `/work` or `/daily` to earn some coins!");
  } else {
    for (const k of entries) {
      const hand = balances[k] ?? 0;
      const inBank = bankBalances[k] ?? 0;
      embed.addFields({
        name: k,
        value: `💰 In Hand: ${coins(hand, k)}\n🏦 In Bank: ${coins(inBank, k)}\n📊 Total: ${coins(hand + inBank, k)}`,
        inline: true,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleDeposit(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const userId = interaction.user.id;
  const amount = interaction.options.getInteger("amount", true);
  const currencyId = interaction.options.getString("currency") ?? "coins";

  const [beforeHand, beforeBank] = await Promise.all([
    getBalance(ctx, userId, currencyId),
    getBankBalance(ctx, userId, currencyId),
  ]);

  try {
    const { handBalance, bankBalance } = await deposit(ctx, userId, currencyId, amount);

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("🏦 Deposit Successful")
      .addFields(
        { name: "Deposited", value: coins(amount, currencyId), inline: false },
        { name: "💰 In Hand", value: `${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}`, inline: true },
        { name: "🏦 In Bank", value: `${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}`, inline: true },
      )
      .setFooter({ text: "💡 Bank funds are safe from /rob" });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const desc = err instanceof MutationError && err.code === "INSUFFICIENT_FUNDS"
      ? `You only have **${coins(beforeHand, currencyId)}** in hand.`
      : err instanceof Error ? err.message : "An error occurred.";
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Deposit Failed").setDescription(desc)],
    });
  }
}

async function handleWithdraw(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const userId = interaction.user.id;
  const amount = interaction.options.getInteger("amount", true);
  const currencyId = interaction.options.getString("currency") ?? "coins";

  const [beforeHand, beforeBank] = await Promise.all([
    getBalance(ctx, userId, currencyId),
    getBankBalance(ctx, userId, currencyId),
  ]);

  try {
    const { handBalance, bankBalance } = await withdraw(ctx, userId, currencyId, amount);

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("💰 Withdrawal Successful")
      .addFields(
        { name: "Withdrawn", value: coins(amount, currencyId), inline: false },
        { name: "💰 In Hand", value: `${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}`, inline: true },
        { name: "🏦 In Bank", value: `${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}`, inline: true },
      )
      .setFooter({ text: "💡 /bank balance • /bank deposit" });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const desc = err instanceof MutationError && err.code === "INSUFFICIENT_FUNDS"
      ? `You only have **${coins(beforeBank, currencyId)}** in your bank.`
      : err instanceof Error ? err.message : "An error occurred.";
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Withdrawal Failed").setDescription(desc)],
    });
  }
}

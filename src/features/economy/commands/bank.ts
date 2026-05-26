import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { UserCurrency } from "@/components/user-currency";
import { ensureAccount } from "@/features/economy/account";
import {
  deposit,
  getBalance,
  getBankBalance,
  MutationError,
  withdraw,
} from "@/features/economy/mutations";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

const data = new SlashCommandBuilder()
  .setName("bank")
  .setDescription("Manage your bank account")
  .addSubcommand((sub) => sub.setName("balance").setDescription("View your hand and bank balance"))
  .addSubcommand((sub) =>
    sub
      .setName("deposit")
      .setDescription("Deposit coins into your bank (safe from /rob)")
      .addIntegerOption((o) =>
        o.setName("amount").setDescription("Amount to deposit").setRequired(true).setMinValue(1),
      )
      .addStringOption((o) => o.setName("currency").setDescription("Currency (default: coins)")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("withdraw")
      .setDescription("Withdraw coins from your bank")
      .addIntegerOption((o) =>
        o.setName("amount").setDescription("Amount to withdraw").setRequired(true).setMinValue(1),
      )
      .addStringOption((o) => o.setName("currency").setDescription("Currency (default: coins)")),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
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

  let bodyText: string;
  if (entries.length === 0) {
    bodyText =
      "## 🏦 Bank Account\nNo currencies yet. Use `/work` or `/daily` to earn some coins!\n\n-# 💡 Bank funds are safe from /rob";
  } else {
    const lines = entries.map((k) => {
      const hand = balances[k] ?? 0;
      const inBank = bankBalances[k] ?? 0;
      return `**${k}**\n💰 In Hand: ${coins(hand, k)}\n🏦 In Bank: ${coins(inBank, k)}\n📊 Total: ${coins(hand + inBank, k)}`;
    });
    bodyText = `## 🏦 Bank Account\n${lines.join("\n\n")}\n\n-# 💡 Bank funds are safe from /rob`;
  }

  await ctx.respond.send(v2Message(container("info", text(bodyText))));
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

    await ctx.respond.send(
      v2Message(
        container(
          "ok",
          text(
            `## 🏦 Deposit Successful\n**Deposited:** ${coins(amount, currencyId)}\n💰 In Hand: ${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}\n🏦 In Bank: ${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}\n\n-# 💡 Bank funds are safe from /rob`,
          ),
        ),
      ),
    );
  } catch (err) {
    const desc =
      err instanceof MutationError && err.code === "INSUFFICIENT_FUNDS"
        ? `You only have **${coins(beforeHand, currencyId)}** in hand.`
        : err instanceof Error
          ? err.message
          : "An error occurred.";
    await ctx.respond.send(v2Message(container("danger", text(`## ❌ Deposit Failed\n${desc}`))));
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

    await ctx.respond.send(
      v2Message(
        container(
          "ok",
          text(
            `## 💰 Withdrawal Successful\n**Withdrawn:** ${coins(amount, currencyId)}\n💰 In Hand: ${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}\n🏦 In Bank: ${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}\n\n-# 💡 /bank balance • /bank deposit`,
          ),
        ),
      ),
    );
  } catch (err) {
    const desc =
      err instanceof MutationError && err.code === "INSUFFICIENT_FUNDS"
        ? `You only have **${coins(beforeBank, currencyId)}** in your bank.`
        : err instanceof Error
          ? err.message
          : "An error occurred.";
    await ctx.respond.send(
      v2Message(container("danger", text(`## ❌ Withdrawal Failed\n${desc}`))),
    );
  }
}

export default defineCommand({
  data,
  help: { hints: ["/balance", "/work"] },
  execute,
});

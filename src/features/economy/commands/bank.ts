import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ensureAccount } from "@/features/economy/account";
import { getBalance, getBankBalance, deposit, withdraw, MutationError } from "@/features/economy/mutations";
import { userStore } from "@/db/repositories/users";
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

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "balance") await handleBalance(interaction);
  else if (sub === "deposit") await handleDeposit(interaction);
  else if (sub === "withdraw") await handleWithdraw(interaction);
}

async function handleBalance(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  await ensureAccount(userId);

  const userRes = await userStore.get(userId);
  if (userRes.isErr()) {
    await interaction.editReply({ content: `Error: ${userRes.error.message}` });
    return;
  }

  const user = userRes.unwrap();
  const currency = user?.currency ?? {};
  const bank = (user as Record<string, unknown> & { bank?: Record<string, number> })?.bank ?? {};

  const allKeys = new Set([...Object.keys(currency), ...Object.keys(bank)]);
  const entries = [...allKeys].filter((k) => (currency[k] ?? 0) > 0 || (bank[k] ?? 0) > 0);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("🏦 Bank Account")
    .setFooter({ text: "💡 Bank funds are safe from /rob" });

  if (entries.length === 0) {
    embed.setDescription("No currencies yet. Use `/work` or `/daily` to earn some coins!");
  } else {
    for (const k of entries) {
      const hand = currency[k] ?? 0;
      const inBank = bank[k] ?? 0;
      const total = hand + inBank;
      embed.addFields({
        name: k,
        value: `💰 In Hand: ${coins(hand, k)}\n🏦 In Bank: ${coins(inBank, k)}\n📊 Total: ${coins(total, k)}`,
        inline: true,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleDeposit(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const amount = interaction.options.getInteger("amount", true);
  const currencyId = interaction.options.getString("currency") ?? "coins";

  const beforeHand = (await getBalance(userId, currencyId)).isOk()
    ? (await getBalance(userId, currencyId)).unwrap()!
    : 0;
  const beforeBank = (await getBankBalance(userId, currencyId)).isOk()
    ? (await getBankBalance(userId, currencyId)).unwrap()!
    : 0;

  const result = await deposit(userId, currencyId, amount);

  if (result.isErr()) {
    const errEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("❌ Deposit Failed")
      .setDescription(
        result.error instanceof MutationError && result.error.code === "INSUFFICIENT_FUNDS"
          ? `You only have **${coins(beforeHand, currencyId)}** in hand.`
          : result.error.message,
      );
    await interaction.editReply({ embeds: [errEmbed] });
    return;
  }

  const { handBalance, bankBalance } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("🏦 Deposit Successful")
    .addFields(
      { name: "Deposited", value: coins(amount, currencyId), inline: false },
      {
        name: "💰 In Hand",
        value: `${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}`,
        inline: true,
      },
      {
        name: "🏦 In Bank",
        value: `${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}`,
        inline: true,
      },
    )
    .setFooter({ text: "💡 Bank funds are safe from /rob" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleWithdraw(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const amount = interaction.options.getInteger("amount", true);
  const currencyId = interaction.options.getString("currency") ?? "coins";

  const beforeHand = (await getBalance(userId, currencyId)).isOk()
    ? (await getBalance(userId, currencyId)).unwrap()!
    : 0;
  const beforeBank = (await getBankBalance(userId, currencyId)).isOk()
    ? (await getBankBalance(userId, currencyId)).unwrap()!
    : 0;

  const result = await withdraw(userId, currencyId, amount);

  if (result.isErr()) {
    const errEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("❌ Withdrawal Failed")
      .setDescription(
        result.error instanceof MutationError && result.error.code === "INSUFFICIENT_FUNDS"
          ? `You only have **${coins(beforeBank, currencyId)}** in your bank.`
          : result.error.message,
      );
    await interaction.editReply({ embeds: [errEmbed] });
    return;
  }

  const { handBalance, bankBalance } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("💰 Withdrawal Successful")
    .addFields(
      { name: "Withdrawn", value: coins(amount, currencyId), inline: false },
      {
        name: "💰 In Hand",
        value: `${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}`,
        inline: true,
      },
      {
        name: "🏦 In Bank",
        value: `${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}`,
        inline: true,
      },
    )
    .setFooter({ text: "💡 /bank balance • /bank deposit" });

  await interaction.editReply({ embeds: [embed] });
}

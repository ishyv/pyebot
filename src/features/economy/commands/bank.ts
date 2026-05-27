import { UserCurrency } from "@/components/user-currency";
import { ensureAccount } from "@/features/economy/account";
import {
  deposit,
  getBalance,
  getBankBalance,
  MutationError,
  withdraw,
} from "@/features/economy/mutations";
import { command, type RunContext } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

const data = command("bank")
  .description("Manage your bank account")
  .subcommand("balance", "View your hand and bank balance")
  .subcommand("deposit", "Deposit coins into your bank (safe from /rob)", (s) =>
    s
      .integer("amount", "Amount to deposit", { required: true, min: 1 })
      .string("currency", "Currency (default: coins)"),
  )
  .subcommand("withdraw", "Withdraw coins from your bank", (s) =>
    s
      .integer("amount", "Amount to withdraw", { required: true, min: 1 })
      .string("currency", "Currency (default: coins)"),
  )
  .guildOnly()
  .defer("ephemeral");

type BankCtx = RunContext<typeof data>;
type BankResponse = ReturnType<typeof v2Message> | { content: string };

async function handleBalance(
  c: Extract<BankCtx, { subcommand: "balance" }>,
): Promise<BankResponse> {
  const { ctx, userId } = c;
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

  return v2Message(container("info", text(bodyText)));
}

async function handleDeposit(
  c: Extract<BankCtx, { subcommand: "deposit" }>,
): Promise<BankResponse> {
  const { ctx, userId, options } = c;
  const amount = options.amount;
  const currencyId = options.currency ?? "coins";

  const [beforeHand, beforeBank] = await Promise.all([
    getBalance(ctx, userId, currencyId),
    getBankBalance(ctx, userId, currencyId),
  ]);

  try {
    const { handBalance, bankBalance } = await deposit(ctx, userId, currencyId, amount);
    return v2Message(
      container(
        "ok",
        text(
          `## 🏦 Deposit Successful\n**Deposited:** ${coins(amount, currencyId)}\n💰 In Hand: ${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}\n🏦 In Bank: ${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}\n\n-# 💡 Bank funds are safe from /rob`,
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
    return v2Message(container("danger", text(`## ❌ Deposit Failed\n${desc}`)));
  }
}

async function handleWithdraw(
  c: Extract<BankCtx, { subcommand: "withdraw" }>,
): Promise<BankResponse> {
  const { ctx, userId, options } = c;
  const amount = options.amount;
  const currencyId = options.currency ?? "coins";

  const [beforeHand, beforeBank] = await Promise.all([
    getBalance(ctx, userId, currencyId),
    getBankBalance(ctx, userId, currencyId),
  ]);

  try {
    const { handBalance, bankBalance } = await withdraw(ctx, userId, currencyId, amount);
    return v2Message(
      container(
        "ok",
        text(
          `## 💰 Withdrawal Successful\n**Withdrawn:** ${coins(amount, currencyId)}\n💰 In Hand: ${coins(beforeHand, currencyId)} → ${coins(handBalance, currencyId)}\n🏦 In Bank: ${coins(beforeBank, currencyId)} → ${coins(bankBalance, currencyId)}\n\n-# 💡 /bank balance • /bank deposit`,
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
    return v2Message(container("danger", text(`## ❌ Withdrawal Failed\n${desc}`)));
  }
}

export default data.help({ hints: ["/balance", "/work"] }).run(async (c) => {
  if (c.subcommand === "balance") return handleBalance(c);
  if (c.subcommand === "deposit") return handleDeposit(c);
  return handleWithdraw(c);
});

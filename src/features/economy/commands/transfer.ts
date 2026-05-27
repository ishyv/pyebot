import { getBalance, MutationError, transfer } from "@/features/economy/mutations";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

export default command("transfer")
  .description("Transfer coins to another user")
  .user("user", "Recipient", { required: true })
  .integer("amount", "Amount to transfer", { required: true, min: 1 })
  .string("currency", "Currency to transfer (default: coins)")
  .guildOnly()
  .defer("public")
  .help({ hints: ["/balance"] })
  .run(async ({ ctx, userId, options }) => {
    const recipient = options.user;
    const amount = options.amount;
    const currencyId = options.currency ?? "coins";

    const beforeBalance = await getBalance(ctx, userId, currencyId);
    const { senderBalance, recipientBalance } = await transfer(
      ctx,
      userId,
      recipient.id,
      currencyId,
      amount,
    );

    return v2Message(
      container(
        "ok",
        text(
          `## 💸 Transfer Sent\n💰 **Your Balance:** ${coins(beforeBalance, currencyId)} → ${coins(senderBalance, currencyId)}\n📤 **Sent:** ${coins(amount, currencyId)}\n📥 **Recipient:** <@${recipient.id}> now has ${coins(recipientBalance, currencyId)}\n\n-# 💡 /balance • /bank`,
        ),
      ),
    );
  })
  .catch(MutationError, (err) =>
    v2Message(container("danger", text(`## ❌ Transfer Failed\n${err.message}`))),
  );

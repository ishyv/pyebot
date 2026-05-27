import type { ChatInputCommandInteraction } from "discord.js";
import { UserCurrency } from "@/components/user-currency";
import { ensureAccount } from "@/features/economy/account";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import type { AccentKey } from "@/ui/theme";
import { container, section, separator, text, thumb, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

const data = command("eco-profile")
  .setDescription("View your economy profile")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;

  const [account, wallet] = await Promise.all([
    ensureAccount(ctx, target.id),
    ctx.get(target.id, UserCurrency),
  ]);

  const handCoins = wallet?.balances["coins"] ?? 0;
  const bankCoins = wallet?.bankBalances["coins"] ?? 0;

  const statusAccent: AccentKey =
    account.status === "ok" ? "ok" : account.status === "blocked" ? "warn" : "danger";

  const statusLabel =
    account.status === "ok"
      ? "✅ Active"
      : account.status === "blocked"
        ? "⚠️ Blocked"
        : "🚫 Banned";

  const memberSince = `<t:${Math.floor(account.createdAt.getTime() / 1000)}:D>`;

  await ctx.respond.send(
    v2Message(
      container(
        statusAccent,
        section(
          `## 👤 Economy Profile — ${target.username}`,
          thumb(target.displayAvatarURL(), "avatar"),
        ),
        separator("sm"),
        text(
          `💰 **In Hand:** ${coins(handCoins)}\n🏦 **In Bank:** ${coins(bankCoins)}\n📊 **Total:** ${coins(handCoins + bankCoins)}\n📅 **Status:** ${statusLabel}\n🗓️ **Member Since:** ${memberSince}\n\n-# 💡 /balance • /bank • /work`,
        ),
      ),
    ),
  );
}

export default data
  .help({ hints: ["/balance", "/inventory"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

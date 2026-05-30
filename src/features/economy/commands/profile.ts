import { UserCurrency } from "@/components/user-currency";
import { ensureAccount } from "@/features/economy/account";
import { command } from "@/framework";
import type { AccentKey } from "@/ui/theme";
import { container, section, separator, text, thumb, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

export default command("eco-profile")
  .description("View your economy profile")
  .user("user", "User to view (defaults to you)")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/balance", "/inventory"] })
  .run(async ({ ctx, user, options }) => {
    const target = options.user ?? user;

    const [account, wallet] = await Promise.all([
      ensureAccount(ctx, target.id),
      ctx.get(target.id, UserCurrency),
    ]);

    const handCoins = wallet?.balances.coins ?? 0;
    const bankCoins = wallet?.bankBalances.coins ?? 0;

    const statusAccent: AccentKey =
      account.status === "ok" ? "ok" : account.status === "blocked" ? "warn" : "danger";

    const statusLabel =
      account.status === "ok"
        ? "✅ Active"
        : account.status === "blocked"
          ? "⚠️ Blocked"
          : "🚫 Banned";

    const memberSince = `<t:${Math.floor(account.createdAt.getTime() / 1000)}:D>`;

    return v2Message(
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
    );
  });

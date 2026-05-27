import { claimDaily, DailyError } from "@/features/economy/daily";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { coins, relativeTs } from "@/utils/fmt";

export default command("daily")
  .description("Claim your daily reward")
  .guildOnly()
  .defer("public")
  .help({ hints: ["/balance", "/work"] })
  .run(async ({ ctx, userId, guildId }) => {
    const { base, streakBonus, total, newBalance, streak, currencyId } = await claimDaily(
      ctx,
      userId,
      guildId,
    );

    const streakLine = "🔥".repeat(Math.min(streak, 10));
    const streakText =
      streak > 0
        ? `${streakLine} **${streak}-day streak!**`
        : "Start your streak by claiming again tomorrow!";

    let body = `## 🎁 Daily Reward\n${streakText}\n\n💰 **Base Reward:** +${coins(base, currencyId)}`;
    if (streakBonus > 0) {
      body += `\n🔥 **Streak Bonus:** +${coins(streakBonus, currencyId)}`;
    }
    body += `\n📊 **Total:** +${coins(total, currencyId)}\n💳 **New Balance:** ${coins(newBalance, currencyId)}\n\n-# 💡 Keep your streak going! Come back tomorrow`;

    return v2Message(container("ok", text(body)));
  })
  .catch(DailyError, (err) => {
    if (err.code === "ON_COOLDOWN" && err.expiresAt) {
      return v2Message(
        container(
          "warn",
          text(
            `## ⏳ Daily on Cooldown\nYou've already claimed your daily reward.\n\nCome back ${relativeTs(err.expiresAt)}\n\n-# 💡 Keep your streak going! Come back tomorrow`,
          ),
        ),
      );
    }
    return { content: `Error: ${err.message}` };
  });

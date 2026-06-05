import { getGuild } from "@/db/repositories/guilds";
import { WorkError, work, workConfigFromGuildEconomy } from "@/features/economy/work";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { coins, relativeTs } from "@/utils/fmt";

export default command("work")
  .description("Work to earn coins")
  .guildOnly()
  .defer("public")
  .help({ hints: ["/coinflip", "/balance"] })
  .run(async ({ ctx, userId, guildId }) => {
    const guildResult = await getGuild(guildId);
    const economy = guildResult.isErr() ? null : (guildResult.unwrap()?.economy ?? null);
    const { payout, currencyId, newBalance, cooldownEndsAt, worksToday, dailyCap } = await work(
      ctx,
      userId,
      workConfigFromGuildEconomy(economy),
    );

    return v2Message(
      container(
        "ok",
        text(
          `## 💼 Work Complete\n💰 **Earned:** +${coins(payout, currencyId)}\n📊 **Balance:** ${coins(newBalance, currencyId)}\n📅 **Shifts Today:** ${worksToday}/${dailyCap}\n⏱️ **Next Shift:** ${relativeTs(cooldownEndsAt.getTime())}\n\n-# 💡 /daily • /coinflip • /balance`,
        ),
      ),
    );
  })
  .catch(WorkError, (err) => {
    if (err.code === "ON_COOLDOWN") {
      return v2Message(
        container(
          "warn",
          text(
            "## ⏳ Work Cooldown\nYou're still tired from your last shift. Take a break!\n\n-# 💡 /daily • /coinflip • /balance",
          ),
        ),
      );
    }
    if (err.code === "DAILY_CAP_REACHED") {
      const tomorrow = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() + 1,
        ),
      );
      return v2Message(
        container(
          "warn",
          text(
            `## 📅 Daily Cap Reached\nYou've reached your work limit for today.\n\nResets ${relativeTs(tomorrow.getTime())}\n\n-# 💡 /daily • /coinflip • /balance`,
          ),
        ),
      );
    }
    return { content: `Error: ${err.message}` };
  });

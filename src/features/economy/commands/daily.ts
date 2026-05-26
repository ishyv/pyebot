import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { claimDaily, DailyError } from "@/features/economy/daily";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { coins, relativeTs } from "@/utils/fmt";

const data = new SlashCommandBuilder().setName("daily").setDescription("Claim your daily reward");

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer();

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  try {
    const { base, streakBonus, total, newBalance, streak, currencyId } = await claimDaily(
      ctx,
      interaction.user.id,
      interaction.guild.id,
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

    await ctx.respond.send(v2Message(container("ok", text(body))));
  } catch (err) {
    if (err instanceof DailyError && err.code === "ON_COOLDOWN" && err.expiresAt) {
      await ctx.respond.send(
        v2Message(
          container(
            "warn",
            text(
              `## ⏳ Daily on Cooldown\nYou've already claimed your daily reward.\n\nCome back ${relativeTs(err.expiresAt)}\n\n-# 💡 Keep your streak going! Come back tomorrow`,
            ),
          ),
        ),
      );
      return;
    }
    await ctx.respond.send({
      content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}

export default defineCommand({
  data,
  help: { hints: ["/balance", "/work"] },
  execute,
});

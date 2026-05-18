import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { GuildEconomy } from "@/components/guild-economy";
import { WorkError, work, workConfigFromGuildEconomy } from "@/features/economy/work";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { coins, relativeTs } from "@/utils/fmt";

const data = new SlashCommandBuilder().setName("work").setDescription("Work to earn coins");

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  try {
    const guildEconomy = await ctx.get(interaction.guild.id, GuildEconomy);
    const { payout, currencyId, newBalance, cooldownEndsAt, worksToday, dailyCap } = await work(
      ctx,
      interaction.user.id,
      workConfigFromGuildEconomy(guildEconomy),
    );

    await interaction.editReply(
      v2Message(
        container(
          "ok",
          text(
            `## 💼 Work Complete\n💰 **Earned:** +${coins(payout, currencyId)}\n📊 **Balance:** ${coins(newBalance, currencyId)}\n📅 **Shifts Today:** ${worksToday}/${dailyCap}\n⏱️ **Next Shift:** ${relativeTs(cooldownEndsAt.getTime())}\n\n-# 💡 /daily • /coinflip • /balance`,
          ),
        ),
      ),
    );
  } catch (err) {
    if (err instanceof WorkError && err.code === "ON_COOLDOWN") {
      await interaction.editReply(
        v2Message(
          container(
            "warn",
            text(
              "## ⏳ Work Cooldown\nYou're still tired from your last shift. Take a break!\n\n-# 💡 /daily • /coinflip • /balance",
            ),
          ),
        ),
      );
      return;
    }
    if (err instanceof WorkError && err.code === "DAILY_CAP_REACHED") {
      const tomorrow = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() + 1,
        ),
      );
      await interaction.editReply(
        v2Message(
          container(
            "warn",
            text(
              `## 📅 Daily Cap Reached\nYou've reached your work limit for today.\n\nResets ${relativeTs(tomorrow.getTime())}\n\n-# 💡 /daily • /coinflip • /balance`,
            ),
          ),
        ),
      );
      return;
    }
    await interaction.editReply({
      content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}

export default defineCommand({
  data,
  help: { hints: ["/coinflip", "/balance"] },
  execute,
});

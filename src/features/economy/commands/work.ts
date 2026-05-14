import {
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { WorkError, work } from "@/features/economy/work";
import { coins, relativeTs } from "@/utils/fmt";

export const data = new SlashCommandBuilder().setName("work").setDescription("Work to earn coins");

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  try {
    const { payout, currencyId, newBalance, cooldownEndsAt, worksToday, dailyCap } = await work(ctx, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("💼 Work Complete")
      .addFields(
        { name: "💰 Earned", value: `+${coins(payout, currencyId)}`, inline: true },
        { name: "📊 Balance", value: coins(newBalance, currencyId), inline: true },
        { name: "📅 Shifts Today", value: `${worksToday}/${dailyCap}`, inline: true },
        { name: "⏱️ Next Shift", value: relativeTs(cooldownEndsAt.getTime()), inline: true },
      )
      .setFooter({ text: "💡 /daily • /coinflip • /balance" });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    if (err instanceof WorkError && err.code === "ON_COOLDOWN") {
      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("⏳ Work Cooldown")
        .setDescription("You're still tired from your last shift. Take a break!")
        .setFooter({ text: "💡 /daily • /coinflip • /balance" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    if (err instanceof WorkError && err.code === "DAILY_CAP_REACHED") {
      const tomorrow = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1),
      );
      const embed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle("📅 Daily Cap Reached")
        .setDescription(`You've reached your work limit for today.\n\nResets ${relativeTs(tomorrow.getTime())}`)
        .setFooter({ text: "💡 /daily • /coinflip • /balance" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    await interaction.editReply({ content: `Error: ${err instanceof Error ? err.message : "Unknown error"}` });
  }
}

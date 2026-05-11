import {
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { claimDaily, DailyError } from "@/features/economy/daily";
import { coins, relativeTs } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Claim your daily reward");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const result = await claimDaily(interaction.user.id, interaction.guild.id);

  if (result.isErr()) {
    const err = result.error;

    if (err instanceof DailyError && err.code === "ON_COOLDOWN" && err.expiresAt) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("⏳ Daily on Cooldown")
        .setDescription(
          `You've already claimed your daily reward.\n\nCome back ${relativeTs(err.expiresAt)}`,
        )
        .setFooter({ text: "💡 Keep your streak going! Come back tomorrow" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: `Error: ${err.message}` });
    return;
  }

  const { base, streakBonus, total, newBalance, streak, currencyId } = result.unwrap();

  const streakLine = "🔥".repeat(Math.min(streak, 10));

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("🎁 Daily Reward")
    .setDescription(
      streak > 0
        ? `${streakLine} **${streak}-day streak!**`
        : "Start your streak by claiming again tomorrow!",
    )
    .addFields({ name: "💰 Base Reward", value: `+${coins(base, currencyId)}`, inline: true });

  if (streakBonus > 0) {
    embed.addFields({
      name: "🔥 Streak Bonus",
      value: `+${coins(streakBonus, currencyId)}`,
      inline: true,
    });
  }

  embed.addFields(
    { name: "📊 Total", value: `+${coins(total, currencyId)}`, inline: false },
    { name: "💳 New Balance", value: coins(newBalance, currencyId), inline: true },
  );

  embed.setFooter({ text: "💡 Keep your streak going! Come back tomorrow" });

  await interaction.editReply({ embeds: [embed] });
}

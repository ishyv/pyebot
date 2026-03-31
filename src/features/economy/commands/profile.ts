import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ensureAccount } from "@/features/economy/account";
import { userStore } from "@/db/repositories/users";
import { coins } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
  .setName("eco-profile")
  .setDescription("View your economy profile")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const isSelf = target.id === interaction.user.id;

  if (isSelf) {
    await ensureAccount(target.id);
  }

  const userRes = await userStore.get(target.id);
  if (userRes.isErr()) {
    await interaction.editReply({ content: `Error: ${userRes.error.message}` });
    return;
  }

  const user = userRes.unwrap();

  if (!user?.economyAccount) {
    await interaction.editReply({
      content: `**${target.username}** doesn't have an economy account yet.`,
    });
    return;
  }

  const account = user.economyAccount;
  const currency = user.currency ?? {};
  const bank = (user as Record<string, unknown> & { bank?: Record<string, number> })?.bank ?? {};

  const totalCoins = (currency["coins"] ?? 0) + (bank["coins"] ?? 0);
  const bankCoins = bank["coins"] ?? 0;
  const handCoins = currency["coins"] ?? 0;

  const statusColor =
    account.status === "ok"
      ? Colors.Green
      : account.status === "blocked"
        ? Colors.Yellow
        : Colors.Red;

  const embed = new EmbedBuilder()
    .setColor(statusColor)
    .setTitle(`👤 Economy Profile — ${target.username}`)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: "💰 In Hand", value: coins(handCoins), inline: true },
      { name: "🏦 In Bank", value: coins(bankCoins), inline: true },
      { name: "📊 Total", value: coins(totalCoins), inline: true },
      { name: "📅 Status", value: account.status === "ok" ? "✅ Active" : account.status === "blocked" ? "⚠️ Blocked" : "🚫 Banned", inline: true },
      { name: "🗓️ Member Since", value: `<t:${Math.floor(account.createdAt.getTime() / 1000)}:D>`, inline: true },
    )
    .setFooter({ text: "💡 /balance • /bank • /work" });

  // Show streak if > 0
  const streak = account.dailyStreak ?? 0;
  if (streak > 0) {
    embed.addFields({ name: "🔥 Daily Streak", value: `${streak} days`, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { EconomyAccount } from "@/components/economy-account";
import { UserCurrency } from "@/components/user-currency";
import { coins } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
  .setName("eco-profile")
  .setDescription("View your economy profile")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;

  const [account, wallet] = await Promise.all([
    ctx.get(target.id, EconomyAccount),
    ctx.get(target.id, UserCurrency),
  ]);

  if (!account) {
    await interaction.editReply({
      content: `**${target.username}** doesn't have an economy account yet.`,
    });
    return;
  }

  const handCoins = wallet?.balances["coins"] ?? 0;
  const bankCoins = wallet?.bankBalances["coins"] ?? 0;

  const statusColor =
    account.status === "ok" ? Colors.Green : account.status === "blocked" ? Colors.Yellow : Colors.Red;

  const embed = new EmbedBuilder()
    .setColor(statusColor)
    .setTitle(`👤 Economy Profile — ${target.username}`)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: "💰 In Hand", value: coins(handCoins), inline: true },
      { name: "🏦 In Bank", value: coins(bankCoins), inline: true },
      { name: "📊 Total", value: coins(handCoins + bankCoins), inline: true },
      {
        name: "📅 Status",
        value: account.status === "ok" ? "✅ Active" : account.status === "blocked" ? "⚠️ Blocked" : "🚫 Banned",
        inline: true,
      },
      { name: "🗓️ Member Since", value: `<t:${Math.floor(account.createdAt.getTime() / 1000)}:D>`, inline: true },
    )
    .setFooter({ text: "💡 /balance • /bank • /work" });

  await interaction.editReply({ embeds: [embed] });
}

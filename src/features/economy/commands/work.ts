import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { work, WorkError } from "@/features/economy/work";
import { ensureAccount } from "@/features/economy/account";
import { getBalance } from "@/features/economy/mutations";
import { coins, relativeTs } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
  .setName("work")
  .setDescription("Work to earn coins");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  // Ensure account exists
  await ensureAccount(interaction.user.id);

  // Record balance before
  const beforeRes = await getBalance(interaction.user.id, "coins");
  const beforeBalance = beforeRes.isOk() ? beforeRes.unwrap() : 0;

  const result = await work(interaction.user.id);

  if (result.isErr()) {
    const err = result.error;

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
      const now = new Date();
      // Next reset is at midnight UTC
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const embed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle("📅 Daily Cap Reached")
        .setDescription(`You've reached your work limit for today.\n\nResets ${relativeTs(tomorrow.getTime())}`)
        .setFooter({ text: "💡 /daily • /coinflip • /balance" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: `Error: ${err.message}` });
    return;
  }

  const { payout, currencyId, newBalance, cooldownEndsAt, worksToday, dailyCap } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("💼 Work Complete")
    .addFields(
      { name: "💰 Earned", value: `+${coins(payout, currencyId)}`, inline: true },
      {
        name: "📊 Balance",
        value: `${coins(beforeBalance, currencyId)} → ${coins(newBalance, currencyId)}`,
        inline: true,
      },
      {
        name: "📅 Shifts Today",
        value: `${worksToday}/${dailyCap}`,
        inline: true,
      },
      {
        name: "⏱️ Next Shift",
        value: relativeTs(cooldownEndsAt.getTime()),
        inline: true,
      },
    )
    .setFooter({ text: "💡 /daily • /coinflip • /balance" });

  await interaction.editReply({ embeds: [embed] });
}

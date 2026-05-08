import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ensureAccount } from "@/features/economy/account";
import { userStore } from "@/db/repositories/users";
import { coins } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check a user's balance")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to check (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const isSelf = target.id === interaction.user.id;

  const embeds: EmbedBuilder[] = [];

  // Auto-create account for self only
  if (isSelf) {
    const ensureRes = await ensureAccount(target.id);
    if (ensureRes.isErr()) {
      await interaction.editReply({ content: `Error: ${ensureRes.error.message}` });
      return;
    }

    if (ensureRes.unwrap().isNew) {
      embeds.push(
        new EmbedBuilder()
          .setColor(Colors.Gold)
          .setTitle("✨ Welcome to the economy!")
          .setDescription(
            "Your account has been created.\nUse `/work` to earn your first coins, or try `/daily` for your daily reward.",
          ),
      );
    }
  }

  // Fetch full balance map
  const userRes = await userStore.get(target.id);
  if (userRes.isErr()) {
    await interaction.editReply({ content: `Error: ${userRes.error.message}` });
    return;
  }

  const user = userRes.unwrap();
  const currency = user?.currency ?? {};
  const bank = (user as Record<string, unknown> & { bank?: Record<string, number> })?.bank ?? {};

  const nonZero = Object.entries(currency).filter(([, v]) => (v as number) > 0);

  const balanceEmbed = new EmbedBuilder()
    .setColor(0xffd700)
    .setAuthor({ name: `${target.username}'s Balance`, iconURL: target.displayAvatarURL() })
    .setFooter({ text: "💡 /work • /daily • /transfer" });

  if (nonZero.length === 0) {
    balanceEmbed.setDescription("No currencies yet. Use `/work` or `/daily` to get started!");
  } else {
    for (const [currencyId, amount] of nonZero) {
      const bankAmount = bank[currencyId] ?? 0;
      const val = bankAmount > 0
        ? `${coins(amount as number, currencyId)} (+ ${coins(bankAmount, currencyId)} in bank)`
        : coins(amount as number, currencyId);
      balanceEmbed.addFields({ name: currencyId, value: val, inline: true });
    }
  }

  embeds.push(balanceEmbed);
  await interaction.editReply({ embeds });
}

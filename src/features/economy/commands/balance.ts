import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { UserCurrency } from "@/components/user-currency";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check a user's coin balance")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to check (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const wallet = await ctx.get(target.id, UserCurrency);
  const balance = wallet?.balances["coins"] ?? 0;

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`${target.username}'s Balance`)
    .setDescription(`**${balance} coins**`);

  await interaction.editReply({ embeds: [embed] });
}

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getUser } from "@/db/repositories/users";

export const data = new SlashCommandBuilder()
  .setName("expedition")
  .setDescription("Enter an expedition — explore a biome, gather resources, and venture deeper");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.user.id;
  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    await interaction.editReply({ content: "Something went wrong. Please try again." });
    return;
  }
  if (!userRes.unwrap()?.rpgProfile) {
    await interaction.editReply({
      content: "You need to set up your RPG profile first. Use `/rpg-profile` to get started.",
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.DarkGold)
    .setTitle("⚔️ Begin an Expedition")
    .setDescription(
      "Choose a biome to explore. Each depth requires a better tool — but yields rarer materials.\n\n" +
      "**⛏️ Mine** — Stone, copper, iron, and silver ore. Requires a pickaxe.\n" +
      "**🌲 Forest** — Oak, spruce, palm, and pine wood. Requires an axe.",
    )
    .setFooter({ text: "💡 /equip • /craft • /inventory" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("expedition:start:mine")
      .setLabel("⛏️ Enter Mine")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("expedition:start:forest")
      .setLabel("🌲 Enter Forest")
      .setStyle(ButtonStyle.Success),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

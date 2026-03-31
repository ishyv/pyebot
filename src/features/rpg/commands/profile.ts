import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getRpgProfile } from "@/db/repositories/rpg";
import { ONBOARD_PREFIX } from "@/features/rpg/handlers/onboard";

export const data = new SlashCommandBuilder()
  .setName("rpg-profile")
  .setDescription("View an RPG profile")
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
  const result = await getRpgProfile(target.id);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const profile = result.unwrap();

  if (!profile) {
    // Only show onboarding for the user's own profile
    if (target.id !== interaction.user.id) {
      await interaction.editReply({ content: "That user hasn't started their RPG journey yet." });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle("⚔️ Choose Your Path")
      .setDescription(
        "Welcome to the RPG! Pick a profession to get started.\n\n" +
        "**⛏️ Miner** — Mine ore, smelt ingots, craft pickaxes.\n" +
        "**🪓 Lumberjack** — Chop wood, process planks, craft axes.",
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${ONBOARD_PREFIX}miner`)
        .setLabel("⛏️ Miner")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${ONBOARD_PREFIX}lumber`)
        .setLabel("🪓 Lumberjack")
        .setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(`${target.username}'s RPG Profile`)
    .addFields(
      { name: "HP", value: `${profile.hpCurrent}`, inline: true },
      { name: "Wins", value: `${profile.wins}`, inline: true },
      { name: "Losses", value: `${profile.losses}`, inline: true },
    );

  if (profile.starterKitType) {
    embed.addFields({ name: "Profession", value: profile.starterKitType, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

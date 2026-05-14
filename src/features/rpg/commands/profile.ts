import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { RpgProfile } from "@/components/rpg-profile";
import { ONBOARD_PREFIX } from "@/features/rpg/handlers/onboard";

export const data = new SlashCommandBuilder()
  .setName("rpg-profile")
  .setDescription("View an RPG profile")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const profile = await ctx.get(target.id, RpgProfile);

  if (!profile) {
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

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ensureRpgProfile, getRpgProfile } from "@/db/repositories/rpg";
import type { RpgProfileData } from "@/db/schemas/rpg-profile";
import { progressBar } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
  .setName("rpg-profile")
  .setDescription("View your RPG profile")
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
    const result = await ensureRpgProfile(target.id);

    if (result.isErr()) {
      await interaction.editReply({ content: `Error: ${result.error.message}` });
      return;
    }

    const profile = result.unwrap();

    // New profile with no profession → show path-selection onboarding
    if (!profile.starterKitType) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle("⚔️ Welcome to the RPG!")
        .setDescription(
          "Your adventure begins now!\n\n**Choose your path** — this shapes your gathering skills and starting equipment.",
        )
        .addFields(
          {
            name: "⛏️ Miner Path",
            value: "Specialize in mining ore and stone. Gain access to mining tools and ore-based recipes.",
            inline: true,
          },
          {
            name: "🪓 Lumber Path",
            value: "Specialize in cutting wood. Gain access to woodcutting tools and wood-based recipes.",
            inline: true,
          },
        )
        .setFooter({ text: "Choose wisely — you can't change your path later!" });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("rpg:onboard:miner")
          .setLabel("⛏️ Miner Path")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("rpg:onboard:lumber")
          .setLabel("🪓 Lumber Path")
          .setStyle(ButtonStyle.Success),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    await interaction.editReply({ embeds: [buildProfileEmbed(target.username, profile)] });
  } else {
    // Viewing someone else — no auto-create
    const result = await getRpgProfile(target.id);

    if (result.isErr()) {
      await interaction.editReply({ content: `Error: ${result.error.message}` });
      return;
    }

    const profile = result.unwrap();

    if (!profile) {
      await interaction.editReply({
        content: `**${target.username}** hasn't started their RPG adventure yet.`,
      });
      return;
    }

    await interaction.editReply({ embeds: [buildProfileEmbed(target.username, profile)] });
  }
}

function buildProfileEmbed(username: string, profile: RpgProfileData): EmbedBuilder {
  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : 0;

  const pathLabel =
    profile.starterKitType === "miner"
      ? "⛏️ Miner"
      : profile.starterKitType === "lumber"
        ? "🪓 Lumber"
        : "None";

  const embed = new EmbedBuilder()
    .setColor(profile.isFighting ? Colors.Red : Colors.Green)
    .setTitle(`⚔️ ${username}'s RPG Profile`)
    .addFields(
      { name: "❤️ HP", value: `${profile.hpCurrent}/100`, inline: true },
      { name: "🏆 Wins", value: `${profile.wins.toLocaleString()}`, inline: true },
      { name: "💀 Losses", value: `${profile.losses.toLocaleString()}`, inline: true },
      { name: "📊 Win Rate", value: `${winRate}%`, inline: true },
      { name: "🗺️ Path", value: pathLabel, inline: true },
      { name: "⚔️ Status", value: profile.isFighting ? "🔴 In Combat" : "🟢 Available", inline: true },
    )
    .setFooter({ text: "💡 /rpg-fight • /gather-mine • /gather-cutdown" });

  // Show equipped items
  const equippedEntries = Object.entries(profile.loadout).filter(([, v]) => v !== null);
  if (equippedEntries.length > 0) {
    const equipLines = equippedEntries.map(([slot, item]) => {
      if (item && typeof item === "object" && "durability" in item) {
        const bar = progressBar(item.durability, 100, 6);
        return `**${slot}**: ${item.itemId} ${bar} (${item.durability} left)`;
      }
      return `**${slot}**: ${typeof item === "string" ? item : "equipped"}`;
    });
    embed.addFields({ name: "🛡️ Equipment", value: equipLines.join("\n") });
  }

  return embed;
}

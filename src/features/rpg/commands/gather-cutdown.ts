import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getEquippedToolTier } from "@/features/rpg/gathering";
import { locationsForAction } from "@/features/rpg/content/locations";
import { getUser } from "@/db/repositories/users";
import { getHints } from "@/utils/command-registry";

export const data = new SlashCommandBuilder()
  .setName("gather-cutdown")
  .setDescription("Choose a forest location and cut down trees");

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

  const userTier = await getEquippedToolTier(userId);
  const locations = locationsForAction("forest");

  const embed = new EmbedBuilder()
    .setColor(Colors.DarkGreen)
    .setTitle("🪓 Where do you want to cut down trees?")
    .setDescription(
      locations
        .map((loc) => {
          const unlocked = loc.requiredTier <= userTier;
          const status = unlocked ? "✅" : "🔒";
          const yields = loc.materials.join(", ");
          return `${status} **${loc.name}** (T${loc.requiredTier}) — ${yields}`;
        })
        .join("\n"),
    )
    .setFooter({ text: getHints("gather-cutdown") });

  const buttons = locations.map((loc) => {
    const unlocked = loc.requiredTier <= userTier;
    return new ButtonBuilder()
      .setCustomId(`gather:forest:${loc.id}`)
      .setLabel(loc.name)
      .setStyle(unlocked ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!unlocked);
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  await interaction.editReply({ embeds: [embed], components: [row] });
}

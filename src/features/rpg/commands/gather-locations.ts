import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { listLocations, getEquippedToolTier } from "@/features/rpg/gathering";
import { getUser } from "@/db/repositories/users";
import { getHints } from "@/utils/command-registry";
import type { GatherAction } from "@/content/schemas";

export const data = new SlashCommandBuilder()
  .setName("gather-locations")
  .setDescription("Browse available gathering spots filtered by your profession and tool tier")
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("Location type to browse (defaults to your profession)")
      .setRequired(false)
      .addChoices(
        { name: "Mine", value: "mine" },
        { name: "Forest", value: "forest" },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.user.id;

  // Fetch user and RPG profile
  const userRes = await getUser(userId);
  const user = userRes.isOk() ? userRes.unwrap() : null;
  const rpgProfile = user?.rpgProfile;

  if (!rpgProfile) {
    await interaction.editReply({
      content: "Use `/rpg-profile` to pick your profession first.",
    });
    return;
  }

  const profession = rpgProfile.starterKitType;

  if (!profession) {
    await interaction.editReply({
      content: "Use `/rpg-profile` to pick your profession first.",
    });
    return;
  }

  // Determine location type from argument or profession
  const typeArg = interaction.options.getString("type") as GatherAction | null;
  let locationType: GatherAction;
  if (typeArg) {
    locationType = typeArg;
  } else if (profession === "miner") {
    locationType = "mine";
  } else if (profession === "lumber") {
    locationType = "forest";
  } else {
    locationType = "mine";
  }

  // Get user's equipped tool tier and locations
  const userTier = await getEquippedToolTier(userId);
  const locations = listLocations(locationType);

  const typeLabel = locationType === "mine" ? "Mine" : "Forest";
  const tierLabel = `Tier ${userTier} tool`;

  const lines = locations.map((loc) => {
    const yieldsText = loc.materials.length > 0 ? loc.materials.join(", ") : loc.id;
    if (loc.requiredTier <= userTier) {
      return `✅ **${loc.name}** (T${loc.requiredTier}) — yields \`${yieldsText}\``;
    } else {
      return `🔒 **${loc.name}** (T${loc.requiredTier}) — requires Tier ${loc.requiredTier} tool`;
    }
  });

  const description =
    lines.length > 0 ? lines.join("\n") : "No locations found for this type.";

  const embed = new EmbedBuilder()
    .setColor(locationType === "mine" ? Colors.Grey : Colors.Green)
    .setTitle(`${typeLabel} Locations`)
    .setDescription(description)
    .addFields({ name: "Your Tool", value: tierLabel, inline: true })
    .setFooter({ text: getHints("gather-locations") });

  await interaction.editReply({ embeds: [embed] });
}

import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getEquippedToolTier } from "@/features/rpg/gathering";
import { locationsForAction } from "@/features/rpg/content/locations";
import {
  defaultActionForProfession,
  parseGatherAction,
  type GatherAction,
} from "@/features/rpg/content/actions";
import { getUser } from "@/db/repositories/users";
import { getHints } from "@/utils/command-registry";

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

  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    await interaction.editReply({ content: "Something went wrong. Please try again." });
    return;
  }
  const rpgProfile = userRes.unwrap()?.rpgProfile;

  if (!rpgProfile?.starterKitType) {
    await interaction.editReply({
      content: "Use `/rpg-profile` to pick your profession first.",
    });
    return;
  }

  // Type arg → user's profession default → "mine" if profession is somehow unknown.
  const typeArg = parseGatherAction(interaction.options.getString("type"));
  const locationType: GatherAction =
    typeArg ?? defaultActionForProfession(rpgProfile.starterKitType);

  const userTier = await getEquippedToolTier(userId);
  const locations = locationsForAction(locationType);

  const typeLabel = locationType === "mine" ? "Mine" : "Forest";
  const tierLabel = `Tier ${userTier} tool`;

  const lines = locations.map((loc) => {
    const yieldsText = loc.materials.length > 0 ? loc.materials.join(", ") : loc.id;
    if (loc.requiredTier <= userTier) {
      return `✅ **${loc.name}** (T${loc.requiredTier}) — yields \`${yieldsText}\``;
    }
    return `🔒 **${loc.name}** (T${loc.requiredTier}) — requires Tier ${loc.requiredTier} tool`;
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

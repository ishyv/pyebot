import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { RpgProfile } from "@/components/rpg-profile";
import { getEquippedToolTier } from "@/features/rpg/gathering";
import { LOCATIONS } from "@/features/rpg/content/locations";
import { getHints } from "@/utils/command-registry";
import type { GatherAction } from "@/features/rpg/content/actions";

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

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.user.id;
  const rpgProfile = await ctx.get(userId, RpgProfile);

  if (!rpgProfile?.starterKitType) {
    await interaction.editReply({ content: "Use `/rpg-profile` to pick your profession first." });
    return;
  }

  const profession = rpgProfile.starterKitType;
  const rawTypeArg = interaction.options.getString("type");
  const typeArg: GatherAction | null =
    rawTypeArg === "mine" || rawTypeArg === "forest" ? rawTypeArg : null;
  const locationType: GatherAction =
    typeArg ?? (profession === "miner" ? "mine" : "forest");

  const userTier = await getEquippedToolTier(userId);
  const locations = Object.entries(LOCATIONS)
    .filter(([, loc]) => loc.action === locationType)
    .map(([id, loc]) => ({ id, ...loc }));

  const typeLabel = locationType === "mine" ? "Mine" : "Forest";
  const tierLabel = `Tier ${userTier} tool`;

  const lines = locations.map((loc) => {
    const yieldsText = loc.materials.length > 0 ? loc.materials.join(", ") : loc.id;
    return loc.requiredTier <= userTier
      ? `✅ **${loc.name}** (T${loc.requiredTier}) — yields \`${yieldsText}\``
      : `🔒 **${loc.name}** (T${loc.requiredTier}) — requires Tier ${loc.requiredTier} tool`;
  });

  const embed = new EmbedBuilder()
    .setColor(locationType === "mine" ? Colors.Grey : Colors.Green)
    .setTitle(`${typeLabel} Locations`)
    .setDescription(lines.length > 0 ? lines.join("\n") : "No locations found for this type.")
    .addFields({ name: "Your Tool", value: tierLabel, inline: true })
    .setFooter({ text: getHints("gather-locations") });

  await interaction.editReply({ embeds: [embed] });
}

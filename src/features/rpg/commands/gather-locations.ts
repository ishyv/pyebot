import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { RpgProfile } from "@/components/rpg-profile";
import type { GatherAction } from "@/features/rpg/content/actions";
import { LOCATIONS } from "@/features/rpg/content/locations";
import { getEquippedToolTier } from "@/features/rpg/gathering";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = new SlashCommandBuilder()
  .setName("gather-locations")
  .setDescription("Browse available gathering spots filtered by your profession and tool tier")
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("Location type to browse (defaults to your profession)")
      .setRequired(false)
      .addChoices({ name: "Mine", value: "mine" }, { name: "Forest", value: "forest" }),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
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
  const locationType: GatherAction = typeArg ?? (profession === "miner" ? "mine" : "forest");

  const userTier = await getEquippedToolTier(ctx, userId);
  const locations = Object.entries(LOCATIONS)
    .filter(([, loc]) => loc.action === locationType)
    .map(([id, loc]) => ({ ...loc, id }));

  const typeLabel = locationType === "mine" ? "Mine" : "Forest";
  const tierLabel = `Tier ${userTier} tool`;

  const lines = locations.map((loc) => {
    const yieldsText = loc.materials.length > 0 ? loc.materials.join(", ") : loc.id;
    return loc.requiredTier <= userTier
      ? `✅ **${loc.name}** (T${loc.requiredTier}) — yields \`${yieldsText}\``
      : `🔒 **${loc.name}** (T${loc.requiredTier}) — requires Tier ${loc.requiredTier} tool`;
  });

  const bodyText = lines.length > 0 ? lines.join("\n") : "No locations found for this type.";

  await interaction.editReply(
    v2Message(
      container(
        "info",
        text(`## ${typeLabel} Locations`),
        separator("sm"),
        text(bodyText),
        separator("sm"),
        text(`**Your Tool:** ${tierLabel}\n-# ${getHints("gather-locations")}`),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/expedition", "/equip", "/rpg-profile"] },
  execute,
});

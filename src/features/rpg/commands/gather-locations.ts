import type { GatherAction } from "@/features/rpg/content/actions";
import { LOCATIONS } from "@/features/rpg/content/locations";
import { getEquippedToolTier } from "@/features/rpg/gathering";
import { getRpgProfile } from "@/features/rpg/profile";
import { command } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

export default command("gather-locations")
  .description("Browse available gathering spots filtered by your profession and tool tier")
  .string("type", "Location type to browse (defaults to your profession)", {
    choices: [
      { name: "Mine", value: "mine" },
      { name: "Forest", value: "forest" },
    ],
  })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/expedition", "/equip", "/rpg-profile"] })
  .run(async ({ ctx, userId, options }) => {
    const rpgProfile = await getRpgProfile(ctx, userId);

    if (!rpgProfile?.starterKitType) {
      return { content: "Use `/rpg-profile` to pick your profession first." };
    }

    const profession = rpgProfile.starterKitType;
    const rawTypeArg = options.type;
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

    return v2Message(
      container(
        "info",
        text(`## ${typeLabel} Locations`),
        separator("sm"),
        text(bodyText),
        separator("sm"),
        text(`**Your Tool:** ${tierLabel}\n-# ${getHints("gather-locations")}`),
      ),
    );
  });

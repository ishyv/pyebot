import { EmbedBuilder, Colors, type ButtonInteraction } from "discord.js";
import { patchRpgProfile } from "@/db/repositories/rpg";
import type { StarterKitType } from "@/db/schemas/rpg-profile";
import type { EquippedItem } from "@/db/schemas/rpg-profile";

export const ONBOARD_PREFIX = "rpg:onboard:";

export function isOnboardButton(customId: string): boolean {
  return customId.startsWith(ONBOARD_PREFIX);
}

const STARTER_TOOLS: Record<StarterKitType, EquippedItem> = {
  miner: { instanceId: "starter", itemId: "starter_pickaxe", durability: 50 },
  lumber: { instanceId: "starter", itemId: "starter_axe", durability: 50 },
};

export async function handleOnboard(interaction: ButtonInteraction): Promise<void> {
  const profession = interaction.customId.slice(ONBOARD_PREFIX.length) as StarterKitType;

  if (profession !== "miner" && profession !== "lumber") {
    await interaction.reply({ content: "Unknown profession.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const starterTool = STARTER_TOOLS[profession];

  const result = await patchRpgProfile(interaction.user.id, {
    starterKitType: profession,
    starterKitClaimedAt: new Date(),
    loadout: {
      weapon: starterTool,
      shield: null,
      helmet: null,
      chest: null,
      pants: null,
      boots: null,
      ring: null,
      necklace: null,
    },
  });

  if (result.isErr()) {
    await interaction.editReply({ content: "Failed to set your path. Please try again." });
    return;
  }

  const label = profession === "miner" ? "⛏️ Miner" : "🪓 Lumber";

  const gatherHint =
    profession === "miner"
      ? "You start with a **starter pickaxe** — use `/gather-mine stone_mine` to begin."
      : "You start with a **starter axe** — use `/gather-cutdown oak_forest` to begin.";

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`${label} Path Chosen!`)
    .setDescription(
      profession === "miner"
        ? "You've chosen the **Miner Path**! Browse available locations with `/gather-locations` and pick your first spot."
        : "You've chosen the **Lumber Path**! Browse available locations with `/gather-locations` and pick your first spot.",
    )
    .addFields(
      { name: "❤️ HP", value: "100/100", inline: true },
      { name: "🏆 Wins", value: "0", inline: true },
      { name: "💀 Losses", value: "0", inline: true },
      { name: "💡 Next Step", value: gatherHint, inline: false },
    )
    .setFooter({ text: "💡 Use /rpg-profile anytime to see your stats" });

  await interaction.editReply({ embeds: [embed] });
}

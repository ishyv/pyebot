import { EmbedBuilder, Colors, type ButtonInteraction } from "discord.js";
import { patchRpgProfile } from "@/db/repositories/rpg";
import type { StarterKitType } from "@/db/schemas/rpg-profile";
import type { EquippedItem } from "@/db/schemas/rpg-profile";
import { TOOLS } from "@/features/rpg/content/tools";

export const ONBOARD_PREFIX = "rpg:onboard:";

export function isOnboardButton(customId: string): boolean {
  return customId.startsWith(ONBOARD_PREFIX);
}

const STARTER_TOOLS: Record<StarterKitType, EquippedItem> = {
  miner: { instanceId: "starter", itemId: "starter_pickaxe", durability: TOOLS.starter_pickaxe.startingDurability },
  lumber: { instanceId: "starter", itemId: "starter_axe", durability: TOOLS.starter_axe.startingDurability },
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
      ? "You start with a **starter pickaxe** — use `/expedition` to enter the mine and begin gathering."
      : "You start with a **starter axe** — use `/expedition` to enter the forest and begin gathering.";

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`${label} Path Chosen!`)
    .setDescription(
      profession === "miner"
        ? "You've chosen the **Miner Path**! Use `/expedition` to enter the mine and start gathering ore."
        : "You've chosen the **Lumber Path**! Use `/expedition` to enter the forest and start cutting wood.",
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

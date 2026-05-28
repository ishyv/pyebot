import { type ButtonInteraction, MessageFlags } from "discord.js";
import type { EquippedItemValue, StarterKitTypeValue } from "@/components/rpg-profile";
import { TOOLS } from "@/features/rpg/content/tools";
import { patchRpgProfile } from "@/features/rpg/profile";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";

export const ONBOARD_PREFIX = "rpg:onboard:";

export function isOnboardButton(customId: string): boolean {
  return customId.startsWith(ONBOARD_PREFIX);
}

const STARTER_TOOLS: Record<StarterKitTypeValue, EquippedItemValue> = {
  miner: {
    instanceId: "starter",
    itemId: "starter_pickaxe",
    durability: TOOLS.starter_pickaxe.startingDurability,
  },
  lumber: {
    instanceId: "starter",
    itemId: "starter_axe",
    durability: TOOLS.starter_axe.startingDurability,
  },
};

export async function handleOnboard(interaction: ButtonInteraction, ctx: Ctx): Promise<void> {
  const profession = interaction.customId.slice(ONBOARD_PREFIX.length) as StarterKitTypeValue;

  if (profession !== "miner" && profession !== "lumber") {
    await interaction.reply({ content: "Unknown profession.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const starterTool = STARTER_TOOLS[profession];

  try {
    await patchRpgProfile(ctx, interaction.user.id, {
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
  } catch (e) {
    console.error(
      "Error while trying to set user rpg profile",
      interaction.user.id,
      interaction,
      e,
    );
    await interaction.editReply({ content: "Failed to set your path. Please try again." });
    return;
  }

  const label = profession === "miner" ? "⛏️ Miner" : "🪓 Lumber";

  const gatherHint =
    profession === "miner"
      ? "You start with a **starter pickaxe** — use `/expedition` to enter the mine and begin gathering."
      : "You start with a **starter axe** — use `/expedition` to enter the forest and begin gathering.";

  const description =
    profession === "miner"
      ? "You've chosen the **Miner Path**! Use `/expedition` to enter the mine and start gathering ore."
      : "You've chosen the **Lumber Path**! Use `/expedition` to enter the forest and start cutting wood.";

  await interaction.editReply(
    v2Message(
      container(
        "ok",
        text(`## ${label} Path Chosen!\n${description}`),
        separator("sm"),
        text(
          `**❤️ HP:** 100/100\n` +
            `**🏆 Wins:** 0\n` +
            `**💀 Losses:** 0\n\n` +
            `**💡 Next Step**\n${gatherHint}\n\n` +
            `-# 💡 Use /rpg-profile anytime to see your stats`,
        ),
      ),
    ),
  );
}

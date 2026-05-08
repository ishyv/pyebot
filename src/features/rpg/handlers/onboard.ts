import { Colors, EmbedBuilder, MessageFlags, type ButtonInteraction } from "discord.js";
import { patchRpgProfile } from "@/db/repositories/rpg";
import type { StarterKitType } from "@/db/schemas/rpg-profile";

export const ONBOARD_PREFIX = "rpg:onboard:";

export function isOnboardButton(customId: string): boolean {
  return customId.startsWith(ONBOARD_PREFIX);
}

export async function handleOnboard(interaction: ButtonInteraction): Promise<void> {
  const profession = interaction.customId.slice(ONBOARD_PREFIX.length) as StarterKitType;

  if (profession !== "miner" && profession !== "lumber") {
    await interaction.reply({ content: "Unknown profession.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await patchRpgProfile(interaction.user.id, {
    starterKitType: profession,
    starterKitClaimedAt: new Date(),
  });

  if (result.isErr()) {
    await interaction.editReply({ content: "Failed to set your path. Please try again." });
    return;
  }

  const label = profession === "miner" ? "⛏️ Miner" : "🪓 Lumber";

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`${label} Path Chosen!`)
    .setDescription(
      profession === "miner"
        ? "You've chosen the **Miner Path**! Head to a mining spot with `/gather-mine` to start collecting ore and stone."
        : "You've chosen the **Lumber Path**! Head to a forest with `/gather-cutdown` to start cutting wood.",
    )
    .addFields(
      { name: "❤️ HP", value: "100/100", inline: true },
      { name: "🏆 Wins", value: "0", inline: true },
      { name: "💀 Losses", value: "0", inline: true },
    )
    .setFooter({ text: "💡 Use /rpg-profile anytime to see your stats" });

  await interaction.editReply({ embeds: [embed] });
}

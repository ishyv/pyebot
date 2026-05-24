import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { getRpgProfile } from "@/features/rpg/profile";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("expedition")
  .setDescription("Enter an expedition — explore a biome, gather resources, and venture deeper");

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.user.id;
  const profile = await getRpgProfile(ctx, userId).catch(() => null);
  if (!profile) {
    await interaction.editReply({
      content: "You need to set up your RPG profile first. Use `/rpg-profile` to get started.",
    });
    return;
  }

  const mineButton = new ButtonBuilder()
    .setCustomId("expedition:start:mine")
    .setLabel("⛏️ Enter Mine")
    .setStyle(ButtonStyle.Primary);

  const forestButton = new ButtonBuilder()
    .setCustomId("expedition:start:forest")
    .setLabel("🌲 Enter Forest")
    .setStyle(ButtonStyle.Success);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(mineButton, forestButton);

  await interaction.editReply({
    ...v2Message(
      container(
        "info",
        text("## ⚔️ Begin an Expedition"),
        separator("sm"),
        text(
          "Choose a biome to explore. Each depth requires a better tool — but yields rarer materials.\n\n" +
            "**⛏️ Mine** — Stone, copper, iron, and silver ore. Requires a pickaxe.\n" +
            "**🌲 Forest** — Oak, spruce, palm, and pine wood. Requires an axe.\n\n" +
            "-# 💡 /equip • /craft • /inventory",
        ),
      ),
    ),
    components: [buttonRow],
  });
}

export default defineCommand({
  data,
  help: { hints: ["/inventory", "/process", "/craft"], requires: "pickaxe or axe in weapon slot" },
  execute,
});

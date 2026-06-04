import { ActionRowBuilder, type ButtonBuilder, ButtonStyle } from "discord.js";
import { getRpgProfile } from "@/features/rpg/profile";
import { expeditionRoutes } from "@/features/rpg/routes";
import { command } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";

export default command("expedition")
  .description("Enter an expedition — explore a biome, gather resources, and venture deeper")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/inventory", "/process", "/craft"], requires: "pickaxe or axe in weapon slot" })
  .run(async ({ ctx, userId }) => {
    const profile = await getRpgProfile(ctx, userId).catch(() => null);
    if (!profile) {
      return {
        content: "You need to set up your RPG profile first. Use `/rpg-profile` to get started.",
      };
    }

    const mineButton = expeditionRoutes.start.button(
      { biome: "mine" },
      { label: "⛏️ Enter Mine", style: ButtonStyle.Primary },
    );

    const forestButton = expeditionRoutes.start.button(
      { biome: "forest" },
      { label: "🌲 Enter Forest", style: ButtonStyle.Success },
    );

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(mineButton, forestButton);

    return {
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
    };
  });

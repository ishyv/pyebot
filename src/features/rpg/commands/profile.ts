import { ActionRowBuilder, type ButtonBuilder, ButtonStyle } from "discord.js";
import { getRpgProfile } from "@/features/rpg/profile";
import { onboardRoutes } from "@/features/rpg/routes";
import { command } from "@/framework";
import { container, section, text, thumb, v2Message } from "@/ui/v2";

export default command("rpg-profile")
  .description("View an RPG profile")
  .user("user", "User to view (defaults to you)")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/expedition", "/fight", "/rpg-quest list"] })
  .run(async ({ ctx, user, options }) => {
    const target = options.user ?? user;
    const profile = await getRpgProfile(ctx, target.id);

    if (!profile) {
      if (target.id !== user.id) {
        return { content: "That user hasn't started their RPG journey yet." };
      }

      const minerButton = onboardRoutes.onboard.button(
        { profession: "miner" },
        { label: "⛏️ Miner", style: ButtonStyle.Primary },
      );

      const lumberButton = onboardRoutes.onboard.button(
        { profession: "lumber" },
        { label: "🪓 Lumberjack", style: ButtonStyle.Success },
      );

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        minerButton,
        lumberButton,
      );

      return {
        ...v2Message(
          container(
            "info",
            text(
              "## ⚔️ Choose Your Path\nWelcome to the RPG! Pick a profession to get started.\n\n" +
                "**⛏️ Miner** — Mine ore, smelt ingots, craft pickaxes.\n" +
                "**🪓 Lumberjack** — Chop wood, process planks, craft axes.",
            ),
          ),
        ),
        components: [buttonRow],
      };
    }

    const avatarUrl = target.displayAvatarURL({ size: 128 });
    const professionLine = profile.starterKitType
      ? `\n**Profession:** ${profile.starterKitType}`
      : "";

    const statsText =
      `## ⚔️ ${target.username}'s RPG Profile\n` +
      `**HP:** ${profile.hpCurrent}/100\n` +
      `**Wins:** ${profile.wins}\n` +
      `**Losses:** ${profile.losses}` +
      professionLine;

    return v2Message(container("info", section(statsText, thumb(avatarUrl, "avatar"))));
  });

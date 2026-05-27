import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { RpgProfile } from "@/components/rpg-profile";
import { ONBOARD_PREFIX } from "@/features/rpg/handlers/onboard";
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
    const profile = await ctx.get(target.id, RpgProfile);

    if (!profile) {
      if (target.id !== user.id) {
        return { content: "That user hasn't started their RPG journey yet." };
      }

      const minerButton = new ButtonBuilder()
        .setCustomId(`${ONBOARD_PREFIX}miner`)
        .setLabel("⛏️ Miner")
        .setStyle(ButtonStyle.Primary);

      const lumberButton = new ButtonBuilder()
        .setCustomId(`${ONBOARD_PREFIX}lumber`)
        .setLabel("🪓 Lumberjack")
        .setStyle(ButtonStyle.Success);

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

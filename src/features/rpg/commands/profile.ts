import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { RpgProfile } from "@/components/rpg-profile";
import { ONBOARD_PREFIX } from "@/features/rpg/handlers/onboard";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, section, text, thumb, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("rpg-profile")
  .setDescription("View an RPG profile")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const profile = await ctx.get(target.id, RpgProfile);

  if (!profile) {
    if (target.id !== interaction.user.id) {
      await ctx.respond.send({ content: "That user hasn't started their RPG journey yet." });
      return;
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

    await ctx.respond.send({
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
    });
    return;
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

  await ctx.respond.send(
    v2Message(container("info", section(statsText, thumb(avatarUrl, "avatar")))),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/expedition", "/fight", "/rpg-quest list"] },
  execute,
});

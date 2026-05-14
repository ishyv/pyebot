import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import {
  REGISTRY,
  CATEGORIES,
  getCommandMeta,
  getCommandsForCategory,
  getHints,
  type CategoryKey,
} from "@/utils/command-registry";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Browse commands by category or get help for a specific command")
  .addStringOption((opt) =>
    opt
      .setName("topic")
      .setDescription("A category (rpg, economy, moderation, utility) or command name")
      .setRequired(false)
      .setAutocomplete(true),
  );

export async function autocomplete(interaction: AutocompleteInteraction, _ctx: Ctx): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();

  const categoryKeys = Object.keys(CATEGORIES) as CategoryKey[];
  const commandNames = Object.keys(REGISTRY);

  const choices = [...categoryKeys, ...commandNames]
    .filter((entry) => entry.toLowerCase().startsWith(focused))
    .map((entry) => ({ name: entry, value: entry }))
    .slice(0, 25);

  await interaction.respond(choices);
}

export async function execute(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const topic = interaction.options.getString("topic");

  // Level 1 — no argument: category overview
  if (!topic) {
    const embed = new EmbedBuilder()
      .setTitle("Help")
      .setDescription("Browse commands by category or use `/help <command>` for details on a specific command.")
      .setColor(Colors.Blurple);

    for (const [, cat] of Object.entries(CATEGORIES)) {
      embed.addFields({
        name: `${cat.emoji} ${cat.label}`,
        value: cat.description,
        inline: false,
      });
    }

    embed.setFooter({ text: "💡 /help rpg • /help economy • /help moderation" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Level 2 — category arg
  if (topic in CATEGORIES) {
    const categoryKey = topic as CategoryKey;
    const cat = CATEGORIES[categoryKey];
    const commands = getCommandsForCategory(categoryKey);

    const embed = new EmbedBuilder()
      .setTitle(`${cat.emoji} ${cat.label} Commands`)
      .setDescription(cat.description)
      .setColor(Colors.Blurple);

    for (const { name, meta } of commands) {
      embed.addFields({
        name: `/${name}`,
        value: meta.description,
        inline: true,
      });
    }

    embed.setFooter({ text: "💡 Use /help <command> for more details" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Level 3 — command arg
  const meta = getCommandMeta(topic);
  if (meta) {
    const embed = new EmbedBuilder()
      .setTitle(`/${topic}`)
      .setDescription(meta.description)
      .setColor(Colors.Blurple);

    if (meta.requires) {
      embed.addFields({ name: "Requires", value: meta.requires, inline: false });
    }

    if (meta.args && meta.args.length > 0) {
      for (const arg of meta.args) {
        embed.addFields({
          name: arg.name,
          value: `${arg.description}${arg.tip ? "\n💡 " + arg.tip : ""}`,
          inline: true,
        });
      }
    }

    if (meta.hints.length > 0) {
      embed.addFields({ name: "See Also", value: meta.hints.join(" • "), inline: false });
    }

    const footer = getHints(topic);
    if (footer) {
      embed.setFooter({ text: footer });
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Unknown topic
  const errorEmbed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setDescription(`Unknown command or category: \`${topic}\`.\nUse \`/help\` to browse all categories.`);

  await interaction.editReply({ embeds: [errorEmbed] });
}

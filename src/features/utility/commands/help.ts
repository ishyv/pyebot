import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { type ContainerChild, container, separator, text, v2Message } from "@/ui/v2";
import {
  getCommandFeatures,
  getCommandMeta,
  getCommandsForFeature,
  getHints,
} from "@/utils/command-registry";

const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Browse commands by category or get help for a specific command")
  .addStringOption((opt) =>
    opt
      .setName("topic")
      .setDescription("A category (rpg, economy, moderation, utility) or command name")
      .setRequired(false)
      .setAutocomplete(true),
  );

async function autocomplete(interaction: AutocompleteInteraction, _ctx: Ctx): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();

  const features = getCommandFeatures();
  const featureIds = features.map((entry) => entry.feature.id);
  const commandNames = features.flatMap((entry) => entry.commands.map((command) => command.name));

  const choices = [...featureIds, ...commandNames]
    .filter((entry) => entry.toLowerCase().startsWith(focused))
    .map((entry) => ({ name: entry, value: entry }))
    .slice(0, 25);

  await interaction.respond(choices);
}

async function execute(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const topic = interaction.options.getString("topic");

  // Level 1 — no argument: category overview
  if (!topic) {
    const categoryLines = getCommandFeatures()
      .map((entry) => `**${entry.feature.name}**\n${entry.feature.description}`)
      .join("\n\n");

    await interaction.editReply(
      v2Message(
        container(
          "info",
          text(
            "## Help\nBrowse commands by category or use `/help <command>` for details on a specific command.",
          ),
          separator("sm"),
          text(categoryLines),
          separator("sm"),
          text("-# /help rpg • /help economy • /help moderation"),
        ),
      ),
    );
    return;
  }

  // Level 2 — category arg
  const feature = getCommandFeatures().find((entry) => entry.feature.id === topic);
  if (feature) {
    const commands = getCommandsForFeature(feature.feature.id);

    const commandLines = commands
      .map(({ name, meta }) => `**/${name}** — ${meta.description}`)
      .join("\n");

    await interaction.editReply(
      v2Message(
        container(
          "info",
          text(`## ${feature.feature.name} Commands\n${feature.feature.description}`),
          separator("sm"),
          text(commandLines || "No commands in this category."),
          separator("sm"),
          text("-# Use /help <command> for more details"),
        ),
      ),
    );
    return;
  }

  // Level 3 — command arg
  const meta = getCommandMeta(topic);
  if (meta) {
    const parts: string[] = [`## /${topic}\n${meta.description}`];

    if (meta.requires) {
      parts.push(`\n**Requires:** ${meta.requires}`);
    }

    if (meta.args && meta.args.length > 0) {
      parts.push("\n**Arguments:**");
      for (const arg of meta.args) {
        const required = arg.required ? " *(required)*" : "";
        parts.push(`• **${arg.name}**${required} — ${arg.description}`);
      }
    }

    if (meta.hints.length > 0) {
      parts.push(`\n**See Also:** ${meta.hints.join(" • ")}`);
    }

    const footer = getHints(topic);
    const children: ContainerChild[] = [text(parts.join("\n"))];
    if (footer) {
      children.push(separator("sm"), text(`-# ${footer}`));
    }

    await interaction.editReply(v2Message(container("info", ...children)));
    return;
  }

  // Unknown topic
  await interaction.editReply(
    v2Message(
      container(
        "danger",
        text(`Unknown command or category: \`${topic}\`.\nUse \`/help\` to browse all categories.`),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: [] },
  autocomplete,
  execute,
});

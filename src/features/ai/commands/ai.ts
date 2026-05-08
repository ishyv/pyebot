/**
 * /ai set-provider <provider> — Set the AI provider for this guild.
 * /ai set-model <model>       — Set the AI model for this guild.
 * /ai clear-memory            — Clear your personal conversation memory.
 */

import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { updateGuildPaths } from "@/db/repositories/guilds";
import { clearMemory } from "@/features/ai/service";
import { aiConfig } from "@/features/ai/config";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";

// Flatten all model names for the set-model command choices
const ALL_MODELS = [
  ...Object.values(aiConfig.providers.openai),
  ...Object.values(aiConfig.providers.anthropic),
  ...Object.values(aiConfig.providers.google),
];
const DEFAULT_OPENAI_MODEL = aiConfig.providers.openai.low;
const DEFAULT_GEMINI_MODEL = aiConfig.providers.google.low;

export const data = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("AI feature configuration")
  .addSubcommand((sub) =>
    sub
      .setName("set-provider")
      .setDescription("Set the AI provider for this server (admin only)")
      .addStringOption((o) =>
        o
          .setName("provider")
          .setDescription("AI provider")
          .setRequired(true)
          .addChoices(
            { name: "Gemini (Google)", value: "gemini" },
            { name: "OpenAI (GPT)", value: "openai" },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-model")
      .setDescription("Set the AI model for this server (admin only)")
      .addStringOption((o) =>
        o
          .setName("model")
          .setDescription("Model name")
          .setRequired(true)
          .addChoices(
          ...[...ALL_MODELS].slice(0,25).map((m) => ({ name: m, value: m })),
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear-memory")
      .setDescription("Clear your personal AI conversation history"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Open the AI configuration panel"),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "set-provider") {
    await handleSetProvider(interaction);
  } else if (sub === "set-model") {
    await handleSetModel(interaction);
  } else if (sub === "clear-memory") {
    await handleClearMemory(interaction);
  } else if (sub === "panel") {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "ai");
  }
}

async function handleSetProvider(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member;
  const isAdmin =
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isAdmin) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Permission Denied").setDescription("Only admins can change the AI provider.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const provider = interaction.options.getString("provider", true);
  const defaultModel = provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;

  const result = await updateGuildPaths(interaction.guildId!, {
    "ai.provider": provider,
    "ai.model": defaultModel,
  });

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update AI provider.")],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle("⚙️ AI Provider Updated")
        .addFields(
          { name: "Provider", value: provider, inline: true },
          { name: "Default Model", value: `\`${defaultModel}\``, inline: true },
        ),
    ],
  });
}

async function handleSetModel(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member;
  const isAdmin =
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isAdmin) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Permission Denied").setDescription("Only admins can change the AI model.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const model = interaction.options.getString("model", true);

  const result = await updateGuildPaths(interaction.guildId!, { "ai.model": model });

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update AI model.")],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle("⚙️ AI Model Updated")
        .addFields({ name: "Model", value: `\`${model}\``, inline: true }),
    ],
  });
}

async function handleClearMemory(interaction: ChatInputCommandInteraction): Promise<void> {
  clearMemory(interaction.user.id);
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("🧹 Memory Cleared")
        .setDescription("Your AI conversation history has been cleared. Fresh start!"),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

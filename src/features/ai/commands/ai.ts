/**
 * /ai set-provider <provider> — Set the AI provider for this guild.
 * /ai set-model <model>       — Set the AI model for this guild.
 * /ai clear-memory            — Clear your personal conversation memory.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { updateGuildPaths } from "@/db/repositories/guilds";
import {
  GEMINI_MODELS,
  OPENAI_MODELS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  clearMemory,
} from "@/features/ai/service";

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
            ...[...GEMINI_MODELS, ...OPENAI_MODELS].map((m) => ({ name: m, value: m })),
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear-memory")
      .setDescription("Clear your personal AI conversation history"),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "set-provider") {
    await handleSetProvider(interaction);
  } else if (sub === "set-model") {
    await handleSetModel(interaction);
  } else if (sub === "clear-memory") {
    await handleClearMemory(interaction);
  }
}

async function handleSetProvider(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member;
  const isAdmin =
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isAdmin) {
    await interaction.reply({ content: "Only admins can change the AI provider.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const provider = interaction.options.getString("provider", true);
  const defaultModel = provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;

  const result = await updateGuildPaths(interaction.guildId!, {
    "ai.provider": provider,
    "ai.model": defaultModel,
  });

  if (result.isErr()) {
    await interaction.editReply({ content: "Failed to update AI provider." });
    return;
  }

  await interaction.editReply({
    content: `AI provider set to **${provider}** (default model: \`${defaultModel}\`).`,
  });
}

async function handleSetModel(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member;
  const isAdmin =
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isAdmin) {
    await interaction.reply({ content: "Only admins can change the AI model.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const model = interaction.options.getString("model", true);

  const result = await updateGuildPaths(interaction.guildId!, { "ai.model": model });

  if (result.isErr()) {
    await interaction.editReply({ content: "Failed to update AI model." });
    return;
  }

  await interaction.editReply({ content: `AI model set to \`${model}\`.` });
}

async function handleClearMemory(interaction: ChatInputCommandInteraction): Promise<void> {
  clearMemory(interaction.user.id);
  await interaction.reply({ content: "Your AI conversation memory has been cleared.", ephemeral: true });
}

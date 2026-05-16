import { defineCommand } from "@/framework";
/**
 * /ai set-provider <provider> — Set the AI provider for this guild.
 * /ai set-model <model>       — Set the AI model for this guild.
 * /ai clear-memory            — Clear your personal conversation memory.
 */

import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { updateGuildPaths } from "@/db/repositories/guilds";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import { aiConfig } from "@/features/ai/config";
import { clearMemory } from "@/features/ai/service";
import { container, separator, text, v2Message } from "@/ui/v2";

// Flatten all model names for the set-model command choices
const ALL_MODELS = [
  ...Object.values(aiConfig.providers.openai),
  ...Object.values(aiConfig.providers.anthropic),
  ...Object.values(aiConfig.providers.google),
];
const DEFAULT_OPENAI_MODEL = aiConfig.providers.openai.low;
const DEFAULT_GEMINI_MODEL = aiConfig.providers.google.low;

const data = new SlashCommandBuilder()
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
          .addChoices(...[...ALL_MODELS].slice(0, 25).map((m) => ({ name: m, value: m }))),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("clear-memory").setDescription("Clear your personal AI conversation history"),
  )
  .addSubcommand((sub) => sub.setName("panel").setDescription("Open the AI configuration panel"));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
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
      ...v2Message(
        container("danger", text("## Permission Denied\nOnly admins can change the AI provider.")),
      ),
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
    await interaction.editReply(
      v2Message(container("danger", text("## Failed\nCould not update AI provider."))),
    );
    return;
  }

  await interaction.editReply(
    v2Message(
      container(
        "info",
        text("## AI Provider Updated"),
        separator("sm"),
        text(`**Provider:** ${provider}\n**Default Model:** \`${defaultModel}\``),
      ),
    ),
  );
}

async function handleSetModel(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member;
  const isAdmin =
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isAdmin) {
    await interaction.reply({
      ...v2Message(
        container("danger", text("## Permission Denied\nOnly admins can change the AI model.")),
      ),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const model = interaction.options.getString("model", true);

  const result = await updateGuildPaths(interaction.guildId!, { "ai.model": model });

  if (result.isErr()) {
    await interaction.editReply(
      v2Message(container("danger", text("## Failed\nCould not update AI model."))),
    );
    return;
  }

  await interaction.editReply(
    v2Message(
      container(
        "info",
        text("## AI Model Updated"),
        separator("sm"),
        text(`**Model:** \`${model}\``),
      ),
    ),
  );
}

async function handleClearMemory(interaction: ChatInputCommandInteraction): Promise<void> {
  clearMemory(interaction.user.id);
  await interaction.reply({
    ...v2Message(
      container(
        "ok",
        text("## Memory Cleared\nYour AI conversation history has been cleared. Fresh start!"),
      ),
    ),
    flags: MessageFlags.Ephemeral,
  });
}

export default defineCommand({
  data,
  help: { hints: ["/context"] },
  execute,
});

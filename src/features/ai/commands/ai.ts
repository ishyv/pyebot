/**
 * /ai set-provider <provider> — Set the AI provider for this guild.
 * /ai set-model <model>       — Set the AI model for this guild.
 * /ai clear-memory            — Clear your personal conversation memory.
 */

import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { updateGuildPaths } from "@/db/repositories/guilds";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import { aiConfig } from "@/features/ai/config";
import { clearMemory } from "@/features/ai/service";
import { command, type RunContext } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";

// Flatten all model names for the set-model command choices
const ALL_MODELS = [
  ...Object.values(aiConfig.providers.openai),
  ...Object.values(aiConfig.providers.anthropic),
  ...Object.values(aiConfig.providers.google),
];
const DEFAULT_OPENAI_MODEL = aiConfig.providers.openai.low;
const DEFAULT_GEMINI_MODEL = aiConfig.providers.google.low;

const data = command("ai")
  .description("AI feature configuration")
  .subcommand("set-provider", "Set the AI provider for this server (admin only)", (s) =>
    s.string("provider", "AI provider", {
      required: true,
      choices: [
        { name: "Gemini (Google)", value: "gemini" },
        { name: "OpenAI (GPT)", value: "openai" },
      ],
    }),
  )
  .subcommand("set-model", "Set the AI model for this server (admin only)", (s) =>
    s.string("model", "Model name", {
      required: true,
      choices: [...ALL_MODELS].slice(0, 25).map((m) => ({ name: m, value: m })),
    }),
  )
  .subcommand("clear-memory", "Clear your personal AI conversation history")
  .subcommand("panel", "Open the AI configuration panel");

type AiCtx = RunContext<typeof data>;

function isAdmin(member: AiCtx["member"]): boolean {
  return (
    member !== null &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

function ephemeralV2(body: ReturnType<typeof container>) {
  const { components } = v2Message(body);
  return { components, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

async function handleSetProvider(c: Extract<AiCtx, { subcommand: "set-provider" }>) {
  if (!isAdmin(c.member)) {
    return ephemeralV2(
      container("danger", text("## Permission Denied\nOnly admins can change the AI provider.")),
    );
  }

  if (!c.guildId) {
    return ephemeralV2(container("danger", text("## Server Only\nUse this command in a server.")));
  }

  await c.ctx.respond.defer({ visibility: "ephemeral" });

  const provider = c.options.provider;
  const defaultModel = provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;

  const result = await updateGuildPaths(c.guildId, {
    "ai.provider": provider,
    "ai.model": defaultModel,
  });

  if (result.isErr()) {
    return v2Message(container("danger", text("## Failed\nCould not update AI provider.")));
  }

  return v2Message(
    container(
      "info",
      text("## AI Provider Updated"),
      separator("sm"),
      text(`**Provider:** ${provider}\n**Default Model:** \`${defaultModel}\``),
    ),
  );
}

async function handleSetModel(c: Extract<AiCtx, { subcommand: "set-model" }>) {
  if (!isAdmin(c.member)) {
    return ephemeralV2(
      container("danger", text("## Permission Denied\nOnly admins can change the AI model.")),
    );
  }

  if (!c.guildId) {
    return ephemeralV2(container("danger", text("## Server Only\nUse this command in a server.")));
  }

  await c.ctx.respond.defer({ visibility: "ephemeral" });

  const model = c.options.model;

  const result = await updateGuildPaths(c.guildId, { "ai.model": model });

  if (result.isErr()) {
    return v2Message(container("danger", text("## Failed\nCould not update AI model.")));
  }

  return v2Message(
    container(
      "info",
      text("## AI Model Updated"),
      separator("sm"),
      text(`**Model:** \`${model}\``),
    ),
  );
}

function handleClearMemory(c: Extract<AiCtx, { subcommand: "clear-memory" }>) {
  clearMemory(c.userId);
  return ephemeralV2(
    container(
      "ok",
      text("## Memory Cleared\nYour AI conversation history has been cleared. Fresh start!"),
    ),
  );
}

export default data.help({ hints: ["/context"] }).run(async (c) => {
  if (c.subcommand === "set-provider") return handleSetProvider(c);
  if (c.subcommand === "set-model") return handleSetModel(c);
  if (c.subcommand === "clear-memory") return handleClearMemory(c);
  if (!(await assertPanelPermission(c.interaction))) return undefined;
  await openAdminPanel(c.interaction, "ai");
  return undefined;
});

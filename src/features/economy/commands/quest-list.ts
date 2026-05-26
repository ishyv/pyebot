import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { browseQuests } from "@/features/economy/quests";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("quest-list")
  .setDescription("Browse available quests");

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const quests = browseQuests().slice(0, 10);

  let body: string;
  if (quests.length === 0) {
    body = "## Available Quests\nNo quests are currently available.";
  } else {
    const lines = quests.map((q) => `**${q.title}** (${q.difficulty}) — ${q.description}`);
    body = `## Available Quests\n${lines.join("\n\n")}`;
  }

  await ctx.respond.send(v2Message(container("info", text(body))));
}

export default defineCommand({
  data,
  help: { hints: ["/quest-accept", "/balance"] },
  execute,
});

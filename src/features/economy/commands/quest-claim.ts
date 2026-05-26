import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { claimRewards } from "@/features/economy/quests";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("quest-claim")
  .setDescription("Claim rewards for a completed quest")
  .addStringOption((opt) =>
    opt.setName("quest_id").setDescription("Quest ID to claim rewards for").setRequired(true),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const questId = interaction.options.getString("quest_id", true);
  const userId = interaction.user.id;

  const result = await claimRewards(ctx, userId, questId);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Error: ${result.error.message}` });
    return;
  }

  const { rewards } = result.unwrap();

  const rewardLines = rewards.map(
    (r) => `**${r.type === "currency" ? "Currency" : "XP"}:** ${r.description}`,
  );

  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(
          `## Rewards Claimed!\nQuest **${questId}** rewards collected.\n\n${rewardLines.join("\n")}`,
        ),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/quest-list", "/balance"] },
  execute,
});

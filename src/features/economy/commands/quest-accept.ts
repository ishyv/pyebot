import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { acceptQuest, QUEST_DEFINITIONS } from "@/features/economy/quests";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

const data = new SlashCommandBuilder()
  .setName("quest-accept")
  .setDescription("Accept a quest")
  .addStringOption((opt) =>
    opt
      .setName("quest_id")
      .setDescription("Quest ID to accept")
      .setRequired(true)
      .addChoices(
        ...QUEST_DEFINITIONS.filter((q) => q.enabled !== false).map((q) => ({
          name: `${q.title} (${q.difficulty})`,
          value: q.id,
        })),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const questId = interaction.options.getString("quest_id", true);
  const userId = interaction.user.id;

  const result = await acceptQuest(userId, questId);

  if (result.isErr()) {
    await ctx.respond.send(
      v2Message(container("danger", text(`## ❌ Quest Not Accepted\n${result.error.message}`))),
    );
    return;
  }

  const def = QUEST_DEFINITIONS.find((q) => q.id === questId);

  let body = `## 📋 Quest Accepted!\n${def?.description ?? `Quest **${questId}** accepted.`}`;

  if (def) {
    const stepLines = def.steps.map((s, i) => {
      if (s.kind === "gather_item") return `${i + 1}. Gather ${s.qty}x **${s.itemId}**`;
      if (s.kind === "fight_win") return `${i + 1}. Win **${s.qty}** fights`;
      if (s.kind === "craft_recipe") return `${i + 1}. Craft ${s.qty}x **${s.recipeId}**`;
      if (s.kind === "market_buy_item")
        return `${i + 1}. Buy ${s.qty}x **${s.itemId}** from market`;
      return `${i + 1}. ${s.kind}`;
    });
    body += `\n\n**📝 Objectives**\n${stepLines.join("\n")}`;

    const rewardLines: string[] = [];
    for (const r of def.rewards.currency ?? []) {
      rewardLines.push(`💰 ${coins(r.amount, r.currencyId)}`);
    }
    if (def.rewards.xp) {
      rewardLines.push(`✨ ${def.rewards.xp} XP`);
    }
    if (rewardLines.length > 0) {
      body += `\n\n**🎁 Rewards**\n${rewardLines.join("\n")}`;
    }

    const repeatLabel = def.repeat.kind === "none" ? "One-time" : def.repeat.kind;
    body += `\n\n**🔁 Repeat:** ${repeatLabel}`;
  }

  body += "\n\n-# 💡 Use /quest-claim when all steps are complete";

  await ctx.respond.send(v2Message(container("info", text(body))));
}

export default defineCommand({
  data,
  help: { hints: ["/quest-claim", "/work", "/balance"] },
  execute,
});

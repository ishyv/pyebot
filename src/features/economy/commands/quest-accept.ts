import { acceptQuest, QUEST_DEFINITIONS } from "@/features/economy/quests";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";

export default command("quest-accept")
  .description("Accept a quest")
  .string("quest_id", "Quest ID to accept", {
    required: true,
    choices: QUEST_DEFINITIONS.filter((q) => q.enabled !== false).map((q) => ({
      name: `${q.title} (${q.difficulty})`,
      value: q.id,
    })),
  })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/quest-claim", "/work", "/balance"] })
  .run(async ({ ctx, userId, options }) => {
    const questId = options.quest_id;
    const result = await acceptQuest(ctx, userId, questId);

    if (result.isErr()) {
      return v2Message(
        container("danger", text(`## ❌ Quest Not Accepted\n${result.error.message}`)),
      );
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

    return v2Message(container("info", text(body)));
  });

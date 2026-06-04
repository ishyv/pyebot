import { acceptRpgQuest, claimRewards, listRpgQuests } from "@/features/rpg/quests";
import { command } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = command("rpg-quest")
  .description("RPG quest commands")
  .subcommand({
    name: "list",
    description: "Browse available RPG quests",
    run: () => {
      const quests = listRpgQuests().slice(0, 10);
      const bodyText =
        quests.length === 0
          ? "No RPG quests are currently available."
          : quests
              .map(({ quest, professionRequired }) => {
                let line = `**${quest.title}** (${quest.difficulty}) — ${quest.description}`;
                if (professionRequired) line += ` [requires ${professionRequired}]`;
                return line;
              })
              .join("\n\n");
      return v2Message(
        container("info", text(`## RPG Quests\n${bodyText}\n-# ${getHints("rpg-quest")}`)),
      );
    },
  })
  .subcommand({
    name: "accept",
    description: "Accept an RPG quest",
    options: (s) => s.string("quest_id", "The quest ID to accept", { required: true }),
    run: async (c) => {
      const { quest_id: questId } = c.options;
      const result = await acceptRpgQuest(c.ctx, c.userId, questId);
      if (result.isErr()) {
        return v2Message(
          container("danger", text(`## ❌ Quest Not Accepted\n${result.error.message}`)),
        );
      }

      const { RPG_QUEST_DEFINITIONS } = await import("@/features/rpg/quests");
      const def = RPG_QUEST_DEFINITIONS.find((q) => q.id === questId);
      const descriptionText = def?.description ?? `Quest **${questId}** accepted.`;

      if (def) {
        const stepLines = def.steps.map((s, i) => {
          if (s.kind === "gather_item") return `${i + 1}. Gather ${s.qty}x **${s.itemId}**`;
          if (s.kind === "fight_win") return `${i + 1}. Win **${s.qty}** fights`;
          return `${i + 1}. ${s.kind}`;
        });
        const rewardLines: string[] = [];
        for (const r of def.rewards.currency ?? []) {
          rewardLines.push(`💰 ${r.amount.toLocaleString()} ${r.currencyId}`);
        }
        if (def.rewards.xp) rewardLines.push(`✨ ${def.rewards.xp} XP`);
        const rewardsText =
          rewardLines.length > 0 ? `\n\n**🎁 Rewards**\n${rewardLines.join("\n")}` : "";
        return v2Message(
          container(
            "ok",
            text(`## 📋 Quest Accepted!\n${descriptionText}`),
            separator("sm"),
            text(
              `**📝 Objectives**\n${stepLines.join("\n")}${rewardsText}\n\n-# 💡 Use /rpg-quest claim when complete`,
            ),
          ),
        );
      }

      return v2Message(
        container(
          "ok",
          text(
            `## 📋 Quest Accepted!\n${descriptionText}\n\n-# 💡 Use /rpg-quest claim when complete`,
          ),
        ),
      );
    },
  })
  .subcommand({
    name: "claim",
    description: "Claim rewards for a completed quest",
    options: (s) => s.string("quest_id", "The quest ID to claim rewards for", { required: true }),
    run: async (c) => {
      const { quest_id: questId } = c.options;
      const result = await claimRewards(c.ctx, c.userId, questId);
      if (result.isErr()) return { content: `Error: ${result.error.message}` };

      const { rewards } = result.unwrap();
      if (rewards.length === 0) {
        return v2Message(
          container(
            "ok",
            text(
              `## Quest Rewards Claimed!\nNo rewards were granted.\n-# ${getHints("rpg-quest")}`,
            ),
          ),
        );
      }

      const rewardLines = rewards
        .map((reward) => {
          if (reward.type === "currency") {
            return `**Currency:** ${reward.amount != null ? `${reward.amount} coins` : reward.description}`;
          }
          if (reward.type === "xp") {
            return `**XP:** ${reward.amount != null ? `${reward.amount}` : reward.description}`;
          }
          return "";
        })
        .filter(Boolean);

      return v2Message(
        container(
          "ok",
          text(`## Quest Rewards Claimed!\n${rewardLines.join("\n")}\n-# ${getHints("rpg-quest")}`),
        ),
      );
    },
  })
  .guildOnly()
  .defer("ephemeral");

export default data.help({ hints: ["/rpg-profile", "/expedition", "/inventory"] });

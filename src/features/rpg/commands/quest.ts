import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { acceptRpgQuest, claimRewards, listRpgQuests } from "@/features/rpg/quests";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = new SlashCommandBuilder()
  .setName("rpg-quest")
  .setDescription("RPG quest commands")
  .addSubcommand((sub) => sub.setName("list").setDescription("Browse available RPG quests"))
  .addSubcommand((sub) =>
    sub
      .setName("accept")
      .setDescription("Accept an RPG quest")
      .addStringOption((opt) =>
        opt.setName("quest_id").setDescription("The quest ID to accept").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("claim")
      .setDescription("Claim rewards for a completed quest")
      .addStringOption((opt) =>
        opt
          .setName("quest_id")
          .setDescription("The quest ID to claim rewards for")
          .setRequired(true),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const subcommand = interaction.options.getSubcommand(true);
  const userId = interaction.user.id;

  if (subcommand === "list") {
    const quests = listRpgQuests().slice(0, 10);

    let bodyText: string;
    if (quests.length === 0) {
      bodyText = "No RPG quests are currently available.";
    } else {
      const lines = quests.map(({ quest, professionRequired }) => {
        let line = `**${quest.title}** (${quest.difficulty}) — ${quest.description}`;
        if (professionRequired) {
          line += ` [requires ${professionRequired}]`;
        }
        return line;
      });
      bodyText = lines.join("\n\n");
    }

    await interaction.editReply(
      v2Message(container("info", text(`## RPG Quests\n${bodyText}\n-# ${getHints("rpg-quest")}`))),
    );
    return;
  }

  if (subcommand === "accept") {
    const questId = interaction.options.getString("quest_id", true);
    const result = await acceptRpgQuest(ctx, userId, questId);

    if (result.isErr()) {
      await interaction.editReply(
        v2Message(container("danger", text(`## ❌ Quest Not Accepted\n${result.error.message}`))),
      );
      return;
    }

    // Find quest def to show details
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

      await interaction.editReply(
        v2Message(
          container(
            "ok",
            text(`## 📋 Quest Accepted!\n${descriptionText}`),
            separator("sm"),
            text(
              `**📝 Objectives**\n${stepLines.join("\n")}${rewardsText}\n\n-# 💡 Use /rpg-quest claim when complete`,
            ),
          ),
        ),
      );
    } else {
      await interaction.editReply(
        v2Message(
          container(
            "ok",
            text(
              `## 📋 Quest Accepted!\n${descriptionText}\n\n-# 💡 Use /rpg-quest claim when complete`,
            ),
          ),
        ),
      );
    }
    return;
  }

  if (subcommand === "claim") {
    const questId = interaction.options.getString("quest_id", true);
    const result = await claimRewards(ctx, userId, questId);

    if (result.isErr()) {
      await interaction.editReply({ content: `Error: ${result.error.message}` });
      return;
    }

    const { rewards } = result.unwrap();

    if (rewards.length === 0) {
      await interaction.editReply(
        v2Message(
          container(
            "ok",
            text(
              `## Quest Rewards Claimed!\nNo rewards were granted.\n-# ${getHints("rpg-quest")}`,
            ),
          ),
        ),
      );
      return;
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

    await interaction.editReply(
      v2Message(
        container(
          "ok",
          text(`## Quest Rewards Claimed!\n${rewardLines.join("\n")}\n-# ${getHints("rpg-quest")}`),
        ),
      ),
    );
    return;
  }
}

export default defineCommand({
  data,
  help: { hints: ["/rpg-profile", "/expedition", "/inventory"] },
  execute,
});

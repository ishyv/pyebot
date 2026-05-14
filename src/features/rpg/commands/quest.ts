import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { listRpgQuests, acceptRpgQuest, claimRewards } from "@/features/rpg/quests";
import { getHints } from "@/utils/command-registry";
import type { Ctx } from "@/framework/types";

export const data = new SlashCommandBuilder()
  .setName("rpg-quest")
  .setDescription("RPG quest commands")
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("Browse available RPG quests"),
  )
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
        opt.setName("quest_id").setDescription("The quest ID to claim rewards for").setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const subcommand = interaction.options.getSubcommand(true);
  const userId = interaction.user.id;

  if (subcommand === "list") {
    const quests = listRpgQuests().slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle("RPG Quests")
      .setFooter({ text: getHints("rpg-quest") });

    if (quests.length === 0) {
      embed.setDescription("No RPG quests are currently available.");
    } else {
      const lines = quests.map(({ quest, professionRequired }) => {
        let line = `**${quest.title}** (${quest.difficulty}) — ${quest.description}`;
        if (professionRequired) {
          line += ` [requires ${professionRequired}]`;
        }
        return line;
      });
      embed.setDescription(lines.join("\n\n"));
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (subcommand === "accept") {
    const questId = interaction.options.getString("quest_id", true);
    const result = await acceptRpgQuest(userId, questId);

    if (result.isErr()) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle("❌ Quest Not Accepted")
            .setDescription(result.error.message),
        ],
      });
      return;
    }

    // Find quest def to show details
    const { RPG_QUEST_DEFINITIONS } = await import("@/features/rpg/quests");
    const def = RPG_QUEST_DEFINITIONS.find((q) => q.id === questId);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle("📋 Quest Accepted!")
      .setDescription(def?.description ?? `Quest **${questId}** accepted.`);

    if (def) {
      const stepLines = def.steps.map((s, i) => {
        if (s.kind === "gather_item") return `${i + 1}. Gather ${s.qty}x **${s.itemId}**`;
        if (s.kind === "fight_win") return `${i + 1}. Win **${s.qty}** fights`;
        return `${i + 1}. ${s.kind}`;
      });
      embed.addFields({ name: "📝 Objectives", value: stepLines.join("\n") });

      const rewardLines: string[] = [];
      for (const r of def.rewards.currency ?? []) {
        rewardLines.push(`💰 ${r.amount.toLocaleString()} ${r.currencyId}`);
      }
      if (def.rewards.xp) rewardLines.push(`✨ ${def.rewards.xp} XP`);
      if (rewardLines.length > 0) {
        embed.addFields({ name: "🎁 Rewards", value: rewardLines.join("\n") });
      }
    }

    embed.setFooter({ text: "💡 Use /rpg-quest claim when complete" });

    await interaction.editReply({ embeds: [embed] });
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

    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle("Quest Rewards Claimed!")
      .setFooter({ text: getHints("rpg-quest") });

    if (rewards.length === 0) {
      embed.setDescription("No rewards were granted.");
    } else {
      for (const reward of rewards) {
        if (reward.type === "currency") {
          embed.addFields({
            name: "Currency",
            value: reward.amount != null ? `${reward.amount} coins` : reward.description,
            inline: true,
          });
        } else if (reward.type === "xp") {
          embed.addFields({
            name: "XP",
            value: reward.amount != null ? `${reward.amount}` : reward.description,
            inline: true,
          });
        }
      }
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }
}

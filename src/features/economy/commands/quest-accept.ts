import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { acceptQuest, QUEST_DEFINITIONS } from "@/features/economy/quests";
import { coins } from "@/utils/fmt";

export const data = new SlashCommandBuilder()
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

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const questId = interaction.options.getString("quest_id", true);
  const userId = interaction.user.id;

  const result = await acceptQuest(userId, questId);

  if (result.isErr()) {
    const errEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("❌ Quest Not Accepted")
      .setDescription(result.error.message);
    await interaction.editReply({ embeds: [errEmbed] });
    return;
  }

  const def = QUEST_DEFINITIONS.find((q) => q.id === questId);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("📋 Quest Accepted!")
    .setDescription(def?.description ?? `Quest **${questId}** accepted.`);

  if (def) {
    // Steps summary
    const stepLines = def.steps.map((s, i) => {
      if (s.kind === "gather_item") return `${i + 1}. Gather ${s.qty}x **${s.itemId}**`;
      if (s.kind === "fight_win") return `${i + 1}. Win **${s.qty}** fights`;
      if (s.kind === "craft_recipe") return `${i + 1}. Craft ${s.qty}x **${s.recipeId}**`;
      if (s.kind === "market_buy_item") return `${i + 1}. Buy ${s.qty}x **${s.itemId}** from market`;
      return `${i + 1}. ${s.kind}`;
    });
    embed.addFields({ name: "📝 Objectives", value: stepLines.join("\n") });

    // Rewards
    const rewardLines: string[] = [];
    for (const r of def.rewards.currency ?? []) {
      rewardLines.push(`💰 ${coins(r.amount, r.currencyId)}`);
    }
    if (def.rewards.xp) {
      rewardLines.push(`✨ ${def.rewards.xp} XP`);
    }
    if (rewardLines.length > 0) {
      embed.addFields({ name: "🎁 Rewards", value: rewardLines.join("\n") });
    }

    embed.addFields({ name: "🔁 Repeat", value: def.repeat.kind === "none" ? "One-time" : def.repeat.kind, inline: true });
  }

  embed.setFooter({ text: "💡 Use /quest-claim when all steps are complete" });

  await interaction.editReply({ embeds: [embed] });
}

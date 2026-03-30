import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { listRpgQuests, acceptRpgQuest, claimRewards } from "@/features/rpg/quests";
import { getHints } from "@/utils/command-registry";

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

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

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
      await interaction.editReply({ content: `Error: ${result.error.message}` });
      return;
    }

    await interaction.editReply({ content: `Quest **${questId}** accepted!` });
    return;
  }

  if (subcommand === "claim") {
    const questId = interaction.options.getString("quest_id", true);
    const result = await claimRewards(userId, questId);

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

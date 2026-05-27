import { claimRewards } from "@/features/economy/quests";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("quest-claim")
  .description("Claim rewards for a completed quest")
  .string("quest_id", "Quest ID to claim rewards for", { required: true })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/quest-list", "/balance"] })
  .run(async ({ ctx, userId, options }) => {
    const result = await claimRewards(ctx, userId, options.quest_id);

    if (result.isErr()) {
      return { content: `Error: ${result.error.message}` };
    }

    const { rewards } = result.unwrap();

    const rewardLines = rewards.map(
      (r) => `**${r.type === "currency" ? "Currency" : "XP"}:** ${r.description}`,
    );

    return v2Message(
      container(
        "ok",
        text(
          `## Rewards Claimed!\nQuest **${options.quest_id}** rewards collected.\n\n${rewardLines.join("\n")}`,
        ),
      ),
    );
  });

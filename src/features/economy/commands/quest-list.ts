import { browseQuests } from "@/features/economy/quests";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("quest-list")
  .description("Browse available quests")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/quest-accept", "/balance"] })
  .run(async () => {
    const quests = browseQuests().slice(0, 10);

    let body: string;
    if (quests.length === 0) {
      body = "## Available Quests\nNo quests are currently available.";
    } else {
      const lines = quests.map((q) => `**${q.title}** (${q.difficulty}) — ${q.description}`);
      body = `## Available Quests\n${lines.join("\n\n")}`;
    }

    return v2Message(container("info", text(body)));
  });

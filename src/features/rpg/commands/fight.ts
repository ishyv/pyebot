import {
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { initiateFight } from "@/features/rpg/combat/fight";
import { defineCommand } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = new SlashCommandBuilder()
  .setName("fight")
  .setDescription("Challenge another user to a fight")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to challenge").setRequired(true),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const userId = interaction.user.id;

  if (target.id === userId) {
    await interaction.editReply({ content: "You cannot challenge yourself to a fight." });
    return;
  }

  const result = await initiateFight(userId, target.id);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { sessionId, expiresAt } = result.unwrap();
  const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);

  const acceptButton = new ButtonBuilder()
    .setCustomId(`fight_accept:${sessionId}`)
    .setLabel("Accept")
    .setStyle(ButtonStyle.Success);

  await interaction.editReply(
    v2Message(
      container(
        "danger",
        section(
          `## Fight Invitation Sent!\nFight invitation sent to <@${target.id}>!\n\nExpires <t:${expiryTimestamp}:R>\n\n-# ${getHints("fight")}`,
          acceptButton,
        ),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/rpg-profile", "/rpg-quest list", "/inventory"] },
  execute,
});

import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { cutdown } from "@/features/rpg/gathering";

export const data = new SlashCommandBuilder()
  .setName("gather-cutdown")
  .setDescription("Cut down trees at a forest location")
  .addStringOption((opt) =>
    opt.setName("location").setDescription("The location ID to cut down trees at").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const location = interaction.options.getString("location", true);
  const userId = interaction.user.id;

  const result = await cutdown(userId, location);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { locationName, tier, materialsGained, remainingDurability, toolBroken } = result.unwrap();

  const materialsText =
    materialsGained.length > 0
      ? materialsGained.map((m) => `${m.quantity}x ${m.id}`).join(", ")
      : "Nothing";

  const durabilityText = toolBroken ? "Tool broke!" : `${remainingDurability}`;

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`You cut down trees at **${locationName}** (Tier ${tier})`)
    .addFields(
      { name: "Materials Gained", value: materialsText, inline: true },
      { name: "Tool Durability", value: durabilityText, inline: true },
    );

  await interaction.editReply({ embeds: [embed] });
}

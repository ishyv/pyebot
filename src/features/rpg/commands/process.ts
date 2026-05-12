import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { process } from "@/features/rpg/processing";
import { getHints } from "@/utils/command-registry";

export const data = new SlashCommandBuilder()
  .setName("process")
  .setDescription("Process raw materials into refined materials")
  .addStringOption((opt) =>
    opt.setName("material").setDescription("The raw material ID to process").setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("quantity")
      .setDescription("How many raw materials to process")
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const material = interaction.options.getString("material", true);
  const quantity = interaction.options.getInteger("quantity", true);
  const userId = interaction.user.id;

  const result = await process(userId, material, quantity);

  if (result.isErr()) {
    const err = result.error;
    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(err.message)
      .setFooter({ text: getHints("process") });
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const {
    rawMaterialId,
    outputMaterialId,
    batchesAttempted,
    batchesSucceeded,
    materialsConsumed,
    outputGained,
    feePaid,
  } = result.unwrap();

  const allSucceeded = batchesSucceeded === batchesAttempted;
  const outputText =
    outputGained > 0 ? `${outputGained}x ${outputMaterialId}` : "0 (all failed)";

  const embed = new EmbedBuilder()
    .setColor(allSucceeded ? Colors.Green : Colors.Orange)
    .setTitle("Processing Complete")
    .addFields(
      { name: "Input", value: `${materialsConsumed}x ${rawMaterialId}`, inline: true },
      { name: "Output", value: outputText, inline: true },
      {
        name: "Batches",
        value: `${batchesSucceeded}/${batchesAttempted} succeeded`,
        inline: true,
      },
    )
    .setFooter({ text: getHints("process") });

  if (feePaid > 0) {
    embed.addFields({ name: "Fee Paid", value: `${feePaid} coins`, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

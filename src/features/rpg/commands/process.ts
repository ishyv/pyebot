import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { process } from "@/features/rpg/processing";
import { defineCommand } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = new SlashCommandBuilder()
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

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
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
    await interaction.editReply(
      v2Message(container("danger", text(`${err.message}\n-# ${getHints("process")}`))),
    );
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
  const outputText = outputGained > 0 ? `${outputGained}x ${outputMaterialId}` : "0 (all failed)";

  const feeText = feePaid > 0 ? `\n**Fee Paid:** ${feePaid} coins` : "";

  await interaction.editReply(
    v2Message(
      container(
        allSucceeded ? "ok" : "warn",
        text("## Processing Complete"),
        separator("sm"),
        text(
          `**Input:** ${materialsConsumed}x ${rawMaterialId}\n` +
            `**Output:** ${outputText}\n` +
            `**Batches:** ${batchesSucceeded}/${batchesAttempted} succeeded` +
            feeText +
            `\n-# ${getHints("process")}`,
        ),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/craft", "/inventory", "/market-list"] },
  execute,
});

import { process } from "@/features/rpg/processing";
import { command } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

export default command("process")
  .description("Process raw materials into refined materials")
  .string("material", "The raw material ID to process", { required: true })
  .integer("quantity", "How many raw materials to process", { required: true, min: 1 })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/craft", "/inventory", "/market-list"] })
  .run(async ({ ctx, userId, options }) => {
    const result = await process(ctx, userId, options.material, options.quantity);

    if (result.isErr()) {
      const err = result.error;
      return v2Message(container("danger", text(`${err.message}\n-# ${getHints("process")}`)));
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

    return v2Message(
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
    );
  });

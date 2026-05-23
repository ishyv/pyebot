import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod policy` updates for the tiered evidence policy. */
export async function handlePolicy(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const preset = interaction.options.getString("preset") as
    | "relaxed"
    | "balanced"
    | "strict"
    | null;
  const aiDetector = interaction.options.getBoolean("ai_detector");
  const staffBypass = interaction.options.getBoolean("staff_bypass");
  const retentionDays = interaction.options.getInteger("retention_days");

  if (preset === null && aiDetector === null && staffBypass === null && retentionDays === null) {
    await ctx.respond.send({ content: "Choose at least one policy option to update." });
    return;
  }

  const result = await saveAutomodSettings(ctx.guildId, {
    policy: {
      ...(preset !== null ? { preset } : {}),
      ...(aiDetector !== null ? { aiDetectorEnabled: aiDetector } : {}),
      ...(staffBypass !== null ? { staffBypass } : {}),
      ...(retentionDays !== null ? { profileRetentionDays: retentionDays } : {}),
    },
  });
  if (await handleDbError(result, ctx, "Could not update AutoMod policy.")) return;

  const policyLines = [
    preset !== null ? `**Preset:** ${preset}` : null,
    aiDetector !== null ? `**AI detector:** ${aiDetector ? "on" : "off"}` : null,
    staffBypass !== null ? `**Staff bypass:** ${staffBypass ? "on" : "off"}` : null,
    retentionDays !== null ? `**Profile retention:** ${retentionDays}d` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.respond.send(
    configUpdateMessage(
      "info",
      "AutoMod Policy Updated",
      "Tiered evidence policy has been updated.",
      policyLines || undefined,
    ),
  );
}

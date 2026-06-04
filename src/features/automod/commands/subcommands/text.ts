import type { ChatInputCommandInteraction } from "discord.js";
import { handleDbError } from "@/core/responseHelpers";
import { getGuild } from "@/db/repositories/guilds";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { invalidatePatternCache } from "@/features/automod/service";
import { configUpdateMessage } from "@/ui/v2";
import type { AutomodSubcommandContext } from "./types";

/** Handles `/automod text` list/add/remove for moderator-friendly text rules. */
export async function handleText(
  interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  if (action === "list") {
    await listTextRules(ctx);
    return;
  }

  const id = interaction.options.getString("id");
  if (!id) {
    await ctx.respond.send({ content: "A text rule id is required." });
    return;
  }

  if (action === "remove") {
    await removeTextRule(ctx, id);
    return;
  }

  await addTextRule(interaction, ctx, id);
}

async function loadTextRules(ctx: AutomodSubcommandContext) {
  const guildResult = await getGuild(ctx.guildId);
  if (await handleDbError(guildResult, ctx, "Failed to load config.")) return null;
  const guild = guildResult.unwrap();
  return guild?.automod.textRules ?? [];
}

async function listTextRules(ctx: AutomodSubcommandContext): Promise<void> {
  const rules = await loadTextRules(ctx);
  if (!rules) return;
  if (rules.length === 0) {
    await ctx.respond.send({ content: "No text rules configured." });
    return;
  }
  const lines = rules.map(
    (rule, i) =>
      `**${i + 1}. ${rule.id}** - ${rule.enabled ? "on" : "off"} - \`${rule.phrases.join("`, `")}\` -> \`${rule.action}\``,
  );
  await ctx.respond.send({ content: lines.join("\n") });
}

async function removeTextRule(ctx: AutomodSubcommandContext, id: string): Promise<void> {
  const rules = await loadTextRules(ctx);
  if (!rules) return;
  const updated = rules.filter((rule) => rule.id !== id);
  if (updated.length === rules.length) {
    await ctx.respond.send({ content: `No text rule named \`${id}\` found.` });
    return;
  }
  const result = await saveAutomodSettings(ctx.guildId, { textRules: updated });
  if (await handleDbError(result, ctx, "Could not remove text rule.")) return;
  invalidatePatternCache(ctx.guildId);
  await ctx.respond.send(
    configUpdateMessage("warn", "Text Rule Removed", `Text rule \`${id}\` has been removed.`),
  );
}

async function addTextRule(
  interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
  id: string,
): Promise<void> {
  const phrases = parsePhraseList(interaction.options.getString("phrase"));
  if (phrases.length === 0) {
    await ctx.respond.send({
      content: "At least one plain word or phrase is required when adding.",
    });
    return;
  }

  const rules = await loadTextRules(ctx);
  if (!rules) return;

  const existing = rules.find((rule) => rule.id === id);
  const response = interaction.options.getString("response") as
    | "delete"
    | "timeout"
    | "report"
    | null;
  const timeoutSeconds =
    interaction.options.getInteger("timeout_seconds") ?? existing?.timeoutSeconds ?? 300;
  const action = response ?? existing?.action ?? "delete";
  const nextRule = {
    id,
    enabled: existing?.enabled ?? true,
    phrases: [...(existing?.phrases ?? []), ...phrases].filter(
      (phrase, index, all) => all.indexOf(phrase) === index,
    ),
    action,
    timeoutSeconds,
  };

  const updated = [...rules.filter((rule) => rule.id !== id), nextRule];
  const result = await saveAutomodSettings(ctx.guildId, { textRules: updated });
  if (await handleDbError(result, ctx, "Could not add text rule.")) return;
  invalidatePatternCache(ctx.guildId);

  await ctx.respond.send(
    configUpdateMessage(
      "ok",
      existing ? "Text Rule Updated" : "Text Rule Added",
      `Text rule \`${id}\` now watches **${nextRule.phrases.length}** phrase${nextRule.phrases.length === 1 ? "" : "s"}.\n\n` +
        `**Phrases:** \`${nextRule.phrases.join("`, `")}\`\n**Action:** ${action}`,
    ),
  );
}

function parsePhraseList(value: string | null): string[] {
  return (value ?? "")
    .split(/[,\n]/)
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .filter((phrase, index, all) => all.indexOf(phrase) === index);
}

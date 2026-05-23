import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { getGuild } from "@/db/repositories/guilds";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { invalidatePatternCache } from "@/features/automod/service";
import { configUpdateMessage, failureMessage } from "@/ui/v2";

/** Handles `/automod pattern` list/add/remove for custom content regexes. */
export async function handlePattern(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);

  if (action === "list") {
    await listPatterns(ctx);
    return;
  }

  const name = interaction.options.getString("name");
  if (!name) {
    await ctx.respond.send({ content: "A pattern name is required." });
    return;
  }

  if (action === "remove") {
    await removePattern(ctx, name);
    return;
  }

  await addPattern(interaction, ctx, name);
}

async function listPatterns(ctx: CommandContext): Promise<void> {
  const guildResult = await getGuild(ctx.guildId);
  if (await handleDbError(guildResult, ctx, "Failed to load config.")) return;
  const guild = guildResult.unwrap();
  if (!guild) {
    await ctx.respond.fail(failureMessage("Failed to load config."));
    return;
  }
  const patterns = guild.automod.customPatterns ?? [];
  if (patterns.length === 0) {
    await ctx.respond.send({ content: "No custom patterns configured." });
    return;
  }
  const lines = patterns.map(
    (p, i) => `**${i + 1}. ${p.name}** — \`/${p.pattern}/${p.flags}\` → \`${p.action}\``,
  );
  await ctx.respond.send({ content: lines.join("\n") });
}

async function removePattern(ctx: CommandContext, name: string): Promise<void> {
  const guildResult = await getGuild(ctx.guildId);
  if (await handleDbError(guildResult, ctx, "Failed to load config.")) return;
  const guild = guildResult.unwrap();
  if (!guild) {
    await ctx.respond.fail(failureMessage("Failed to load config."));
    return;
  }
  const patterns = guild.automod.customPatterns ?? [];
  const updated = patterns.filter((p) => p.name !== name);
  if (updated.length === patterns.length) {
    await ctx.respond.send({ content: `No pattern named \`${name}\` found.` });
    return;
  }
  const result = await saveAutomodSettings(ctx.guildId, { customPatterns: updated });
  if (await handleDbError(result, ctx, "Could not remove custom pattern.")) return;
  invalidatePatternCache(ctx.guildId);
  await ctx.respond.send(
    configUpdateMessage("warn", "Pattern Removed", `Pattern \`${name}\` has been removed.`),
  );
}

async function addPattern(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
  name: string,
): Promise<void> {
  const regex = interaction.options.getString("regex");
  if (!regex) {
    await ctx.respond.send({ content: "A regex pattern is required when adding." });
    return;
  }

  const flags = interaction.options.getString("flags") ?? "i";
  const response = (interaction.options.getString("response") ?? "delete") as
    | "delete"
    | "timeout"
    | "report";
  const timeoutSeconds = interaction.options.getInteger("timeout_seconds") ?? 300;

  try {
    new RegExp(regex, flags);
  } catch {
    await ctx.respond.send({ content: `Invalid regex: \`/${regex}/${flags}\`` });
    return;
  }

  const guildResult = await getGuild(ctx.guildId);
  if (await handleDbError(guildResult, ctx, "Failed to load config.")) return;
  const guild = guildResult.unwrap();
  if (!guild) {
    await ctx.respond.fail(failureMessage("Failed to load config."));
    return;
  }

  const patterns = guild.automod.customPatterns ?? [];
  if (patterns.some((p) => p.name === name)) {
    await ctx.respond.send({
      content: `A pattern named \`${name}\` already exists. Remove it first.`,
    });
    return;
  }

  const updated = [...patterns, { name, pattern: regex, flags, action: response, timeoutSeconds }];
  const result = await saveAutomodSettings(ctx.guildId, { customPatterns: updated });
  if (await handleDbError(result, ctx, "Could not add custom pattern.")) return;
  invalidatePatternCache(ctx.guildId);

  await ctx.respond.send(
    configUpdateMessage(
      "ok",
      "Pattern Added",
      `Pattern \`${name}\` has been added.\n\n**Regex:** \`/${regex}/${flags}\`\n**Action:** ${response}`,
    ),
  );
}

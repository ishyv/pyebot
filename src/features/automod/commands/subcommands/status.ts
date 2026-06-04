import type { ChatInputCommandInteraction } from "discord.js";
import { handleDbError } from "@/core/responseHelpers";
import { getGuild } from "@/db/repositories/guilds";
import { failureMessage } from "@/ui/v2";
import type { AutomodSubcommandContext } from "./types";

/** Handles `/automod status`, the plain-text operational config summary. */
export async function handleStatus(
  _interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildResult = await getGuild(ctx.guildId);
  if (await handleDbError(guildResult, ctx, "Failed to load config.")) return;
  const guild = guildResult.unwrap();
  if (!guild) {
    await ctx.respond.fail(failureMessage("Failed to load config."));
    return;
  }

  const automod = guild.automod;
  const ls = automod.linkSpam;
  const dw = automod.domainWhitelist;
  const cs = automod.crossChannelSpam;
  const ms = automod.mentionSpam;
  const sm = automod.slowmode;
  const rd = automod.raidDetection;
  const cp = automod.customPatterns ?? [];
  const tr = automod.textRules ?? [];
  const policy = automod.policy;
  const image = automod.imageDetection;

  const lines = [
    `**Policy:** \`${policy.preset}\` | Profiles: ${policy.profileRetentionDays}d | AI detector: ${policy.aiDetector.enabled ? "on" : "off"}`,
    `  Staff bypass: ${policy.bypass.staffBypass ? "on" : "off"} | Ignored channels: ${policy.bypass.ignoredChannelIds.length} | Strict channels: ${policy.bypass.strictChannelIds.length}`,
    `**Link Spam:** ${ls.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Max links: ${ls.maxLinks} per ${ls.windowSeconds}s | Action: \`${ls.action}\``,
    `  Report channel: ${ls.reportChannelId ? `<#${ls.reportChannelId}>` : "none"}`,
    `**Domain Whitelist:** ${dw.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Domains: ${dw.domains.length > 0 ? dw.domains.join(", ") : "none"}`,
    `**Cross-Channel Spam:** ${cs.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Trigger: ${cs.minChannels} channels in ${cs.windowSeconds}s | Auto-timeout: ${cs.autoTimeout ? `${cs.timeoutSeconds}s` : "off"}`,
    `  Report channel: ${cs.reportChannelId ? `<#${cs.reportChannelId}>` : "none"}`,
    `**Mention Spam:** ${ms.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Max mentions: ${ms.maxMentions} in ${ms.windowSeconds}s | Action: \`${ms.action}\``,
    `**Auto-Slowmode:** ${sm.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Trigger: ${sm.messagesPerWindow} msgs in ${sm.windowSeconds}s → ${sm.slowmodeSeconds}s slowmode for ${sm.releaseAfterSeconds}s`,
    `**Raid Detection:** ${rd.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Threshold: ${rd.joinsPerMinute} joins/min | Min age: ${rd.minAccountAgeDays}d | Action: \`${rd.action}\``,
    `  Report channel: ${rd.reportChannelId ? `<#${rd.reportChannelId}>` : "none"}`,
    `**Banned Images:** ${image.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Tolerance: \`${image.tolerance}\` | Report channel: ${image.reportChannelId ? `<#${image.reportChannelId}>` : "none"}`,
    `**Text Rules:** ${tr.length} rule${tr.length !== 1 ? "s" : ""} configured`,
    ...(tr.length > 0
      ? tr.map((rule) => `  • \`${rule.id}\` (\`${rule.phrases.join("`, `")}\`) → ${rule.action}`)
      : []),
    `**Advanced Regex Patterns:** ${cp.length} pattern${cp.length !== 1 ? "s" : ""} configured`,
    ...(cp.length > 0 ? cp.map((p) => `  • \`${p.name}\` (\`${p.pattern}\`) → ${p.action}`) : []),
  ];

  await ctx.respond.send({ content: lines.join("\n") });
}

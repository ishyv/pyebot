/**
 * /automod linkspam <enable|disable> [options]
 * /automod whitelist <add|remove> <domain>
 * /automod report-channel <channel>
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { CommandContext } from "@/core/feature";
import { getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";

export const data = new SlashCommandBuilder()
  .setName("automod")
  .setDescription("Configure automatic moderation")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("linkspam")
      .setDescription("Configure link spam detection")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Enable or disable link spam detection")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addIntegerOption((o) =>
        o.setName("max_links").setDescription("Max links per window (default 4)").setMinValue(1).setMaxValue(20),
      )
      .addIntegerOption((o) =>
        o.setName("window_seconds").setDescription("Window in seconds (default 10)").setMinValue(5).setMaxValue(120),
      )
      .addStringOption((o) =>
        o
          .setName("response")
          .setDescription("What to do when triggered (default: timeout)")
          .addChoices(
            { name: "Timeout", value: "timeout" },
            { name: "Delete", value: "delete" },
            { name: "Report only", value: "report" },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("whitelist")
      .setDescription("Manage domain whitelist")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Add or remove a domain")
          .setRequired(true)
          .addChoices(
            { name: "Add", value: "add" },
            { name: "Remove", value: "remove" },
          ),
      )
      .addStringOption((o) =>
        o.setName("domain").setDescription("Domain to add/remove (e.g. example.com)").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("report-channel")
      .setDescription("Set the channel where automod reports are sent")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Report channel (omit to clear)"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("Show current automod configuration"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("mentionspam")
      .setDescription("Configure mention spam detection")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Enable or disable mention spam detection")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addIntegerOption((o) =>
        o.setName("max_mentions").setDescription("Max mentions per message/window (default 5)").setMinValue(1).setMaxValue(50),
      )
      .addIntegerOption((o) =>
        o.setName("window_seconds").setDescription("Window in seconds (default 10)").setMinValue(5).setMaxValue(120),
      )
      .addStringOption((o) =>
        o
          .setName("response")
          .setDescription("What to do when triggered (default: timeout)")
          .addChoices(
            { name: "Timeout", value: "timeout" },
            { name: "Delete", value: "delete" },
            { name: "Report only", value: "report" },
          ),
      )
      .addIntegerOption((o) =>
        o.setName("timeout_seconds").setDescription("Timeout duration in seconds (default 600)").setMinValue(60).setMaxValue(604800),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("slowmode")
      .setDescription("Configure automatic slowmode on message spikes")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Enable or disable automatic slowmode")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addIntegerOption((o) =>
        o.setName("messages_per_window").setDescription("Messages to trigger slowmode (default 20)").setMinValue(5).setMaxValue(200),
      )
      .addIntegerOption((o) =>
        o.setName("window_seconds").setDescription("Detection window in seconds (default 60)").setMinValue(10).setMaxValue(300),
      )
      .addIntegerOption((o) =>
        o.setName("slowmode_seconds").setDescription("Slowmode rate limit to apply (default 5)").setMinValue(1).setMaxValue(21600),
      )
      .addIntegerOption((o) =>
        o.setName("release_after").setDescription("Seconds before slowmode is lifted (default 60)").setMinValue(10).setMaxValue(3600),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("raid")
      .setDescription("Configure raid detection")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Enable or disable raid detection")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addIntegerOption((o) =>
        o.setName("joins_per_minute").setDescription("Join rate to trigger detection (default 10)").setMinValue(3).setMaxValue(100),
      )
      .addIntegerOption((o) =>
        o.setName("min_account_age").setDescription("Account age in days considered 'new' (default 7)").setMinValue(0).setMaxValue(30),
      )
      .addStringOption((o) =>
        o
          .setName("response")
          .setDescription("Action to take on raid detection (default: alert)")
          .addChoices(
            { name: "Alert only", value: "alert" },
            { name: "Lockdown server", value: "lockdown" },
          ),
      )
      .addChannelOption((o) =>
        o.setName("report_channel").setDescription("Channel to send raid alerts (omit to clear)"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("pattern")
      .setDescription("Manage custom regex patterns")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Add, remove, or list patterns")
          .setRequired(true)
          .addChoices(
            { name: "Add", value: "add" },
            { name: "Remove", value: "remove" },
            { name: "List", value: "list" },
          ),
      )
      .addStringOption((o) =>
        o.setName("name").setDescription("Pattern name (required for add/remove)"),
      )
      .addStringOption((o) =>
        o.setName("regex").setDescription("Regex pattern (required for add)"),
      )
      .addStringOption((o) =>
        o.setName("flags").setDescription("Regex flags (default: i)"),
      )
      .addStringOption((o) =>
        o
          .setName("response")
          .setDescription("Action when pattern matches (default: delete)")
          .addChoices(
            { name: "Delete", value: "delete" },
            { name: "Timeout", value: "timeout" },
            { name: "Report only", value: "report" },
          ),
      )
      .addIntegerOption((o) =>
        o.setName("timeout_seconds").setDescription("Timeout duration in seconds (default 300)").setMinValue(60).setMaxValue(604800),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("crosschannel")
      .setDescription("Configure cross-channel spam bot detection")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Enable or disable cross-channel spam detection")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addIntegerOption((o) =>
        o
          .setName("min_channels")
          .setDescription("Unique channels required to trigger (default 3)")
          .setMinValue(2)
          .setMaxValue(20),
      )
      .addIntegerOption((o) =>
        o
          .setName("window_seconds")
          .setDescription("Detection window in seconds (default 30)")
          .setMinValue(5)
          .setMaxValue(300),
      )
      .addChannelOption((o) =>
        o.setName("report_channel").setDescription("Channel to send mod alerts (omit to clear)"),
      )
      .addBooleanOption((o) =>
        o.setName("auto_timeout").setDescription("Auto-timeout the user on detection (default true)"),
      )
      .addIntegerOption((o) =>
        o
          .setName("timeout_seconds")
          .setDescription("Timeout duration in seconds when auto-timeout fires (default 3600)")
          .setMinValue(60)
          .setMaxValue(604800),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Open the automod configuration panel"),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "linkspam") await handleLinkspam(interaction, ctx);
  else if (sub === "whitelist") await handleWhitelist(interaction, ctx);
  else if (sub === "report-channel") await handleReportChannel(interaction, ctx);
  else if (sub === "status") await handleStatus(interaction, ctx);
  else if (sub === "crosschannel") await handleCrossChannel(interaction, ctx);
  else if (sub === "mentionspam") await handleMentionSpam(interaction, ctx);
  else if (sub === "slowmode") await handleSlowmode(interaction, ctx);
  else if (sub === "raid") await handleRaid(interaction, ctx);
  else if (sub === "pattern") await handlePattern(interaction, ctx);
  else if (sub === "panel") {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "automod");
  }
}

async function handleLinkspam(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";

  const paths: Record<string, unknown> = { "automod.linkSpam.enabled": enabled };

  const maxLinks = interaction.options.getInteger("max_links");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const response = interaction.options.getString("response");

  if (maxLinks !== null) paths["automod.linkSpam.maxLinks"] = maxLinks;
  if (windowSeconds !== null) paths["automod.linkSpam.windowSeconds"] = windowSeconds;
  if (response !== null) paths["automod.linkSpam.action"] = response;

  const result = await updateGuildPaths(guildId, paths, { upsert: true });

  if (result.isErr()) {
    await ctx.respond.fail({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update configuration.")],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(enabled ? Colors.Green : Colors.Grey)
    .setTitle("⚙️ Link Spam Detection Updated")
    .setDescription(`Link spam detection is now **${enabled ? "enabled" : "disabled"}**.`)
    .setFooter({ text: "💡 Use /automod status to see full config" });

  if (maxLinks !== null) embed.addFields({ name: "Max Links", value: `${maxLinks}`, inline: true });
  if (windowSeconds !== null) embed.addFields({ name: "Window", value: `${windowSeconds}s`, inline: true });
  if (response !== null) embed.addFields({ name: "Action", value: response, inline: true });

  await ctx.respond.send({ embeds: [embed] });
}

async function handleWhitelist(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const action = interaction.options.getString("action", true);
  const domain = interaction.options.getString("domain", true).toLowerCase().trim();

  const guildResult = await getGuild(guildId);
  if (guildResult.isErr()) {
    await ctx.respond.send({ content: "Failed to load guild config." });
    return;
  }

  const current = guildResult.unwrap()?.automod.domainWhitelist.domains ?? [];

  let updated: string[];
  if (action === "add") {
    if (current.includes(domain)) {
      await ctx.respond.send({ content: `\`${domain}\` is already whitelisted.` });
      return;
    }
    updated = [...current, domain];
  } else {
    updated = current.filter((d) => d !== domain);
    if (updated.length === current.length) {
      await ctx.respond.send({ content: `\`${domain}\` is not in the whitelist.` });
      return;
    }
  }

  const result = await updateGuildPaths(guildId, {
    "automod.domainWhitelist.enabled": true,
    "automod.domainWhitelist.domains": updated,
  }, { upsert: true });

  if (result.isErr()) {
    await ctx.respond.fail({ content: "Could not update domain whitelist." });
    return;
  }

  await ctx.respond.send({
    embeds: [
      new EmbedBuilder()
        .setColor(action === "add" ? Colors.Green : Colors.Orange)
        .setTitle(`${action === "add" ? "✅ Domain Added" : "🗑️ Domain Removed"}`)
        .setDescription(`\`${domain}\` has been ${action === "add" ? "added to" : "removed from"} the whitelist.`)
        .addFields({ name: "Total Entries", value: `${updated.length}`, inline: true }),
    ],
  });
}

async function handleReportChannel(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const channel = interaction.options.getChannel("channel");
  const channelId = channel?.id ?? null;

  const result = await updateGuildPaths(guildId, {
    "automod.linkSpam.reportChannelId": channelId,
  }, { upsert: true });

  if (result.isErr()) {
    await ctx.respond.fail({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update report channel.")],
    });
    return;
  }

  await ctx.respond.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle("⚙️ Report Channel Updated")
        .setDescription(channelId ? `Automod reports will be sent to <#${channelId}>.` : "Report channel cleared — reports are disabled."),
    ],
  });
}

async function handleStatus(_interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const guildResult = await getGuild(guildId);

  const guild = guildResult.isOk() ? guildResult.unwrap() : null;
  if (!guild) {
    await ctx.respond.send({ content: "Failed to load config." });
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

  const lines = [
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
    `**Custom Patterns:** ${cp.length} pattern${cp.length !== 1 ? "s" : ""} configured`,
    ...(cp.length > 0 ? cp.map((p) => `  • \`${p.name}\` (\`${p.pattern}\`) → ${p.action}`) : []),
  ];

  await ctx.respond.send({ content: lines.join("\n") });
}

async function handleCrossChannel(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";

  const paths: Record<string, unknown> = { "automod.crossChannelSpam.enabled": enabled };

  const minChannels = interaction.options.getInteger("min_channels");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const reportChannel = interaction.options.getChannel("report_channel");
  const autoTimeout = interaction.options.getBoolean("auto_timeout");
  const timeoutSeconds = interaction.options.getInteger("timeout_seconds");

  if (minChannels !== null) paths["automod.crossChannelSpam.minChannels"] = minChannels;
  if (windowSeconds !== null) paths["automod.crossChannelSpam.windowSeconds"] = windowSeconds;
  if (reportChannel !== undefined) paths["automod.crossChannelSpam.reportChannelId"] = reportChannel?.id ?? null;
  if (autoTimeout !== null) paths["automod.crossChannelSpam.autoTimeout"] = autoTimeout;
  if (timeoutSeconds !== null) paths["automod.crossChannelSpam.timeoutSeconds"] = timeoutSeconds;

  const result = await updateGuildPaths(guildId, paths, { upsert: true });

  if (result.isErr()) {
    await ctx.respond.fail({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update configuration.")],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(enabled ? Colors.Green : Colors.Grey)
    .setTitle("⚙️ Cross-Channel Spam Detection Updated")
    .setDescription(`Cross-channel spam detection is now **${enabled ? "enabled" : "disabled"}**.`)
    .setFooter({ text: "💡 Use /automod status to see full config" });

  if (minChannels !== null) embed.addFields({ name: "Min Channels", value: `${minChannels}`, inline: true });
  if (windowSeconds !== null) embed.addFields({ name: "Window", value: `${windowSeconds}s`, inline: true });
  if (autoTimeout !== null) embed.addFields({ name: "Auto-timeout", value: autoTimeout ? "on" : "off", inline: true });
  if (timeoutSeconds !== null) embed.addFields({ name: "Timeout Duration", value: `${timeoutSeconds}s`, inline: true });
  if (reportChannel !== undefined) {
    embed.addFields({ name: "Report Channel", value: reportChannel ? `<#${reportChannel.id}>` : "cleared", inline: true });
  }

  await ctx.respond.send({ embeds: [embed] });
}

async function handleMentionSpam(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";

  const paths: Record<string, unknown> = { "automod.mentionSpam.enabled": enabled };

  const maxMentions = interaction.options.getInteger("max_mentions");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const response = interaction.options.getString("response");
  const timeoutSeconds = interaction.options.getInteger("timeout_seconds");

  if (maxMentions !== null) paths["automod.mentionSpam.maxMentions"] = maxMentions;
  if (windowSeconds !== null) paths["automod.mentionSpam.windowSeconds"] = windowSeconds;
  if (response !== null) paths["automod.mentionSpam.action"] = response;
  if (timeoutSeconds !== null) paths["automod.mentionSpam.timeoutSeconds"] = timeoutSeconds;

  const result = await updateGuildPaths(guildId, paths, { upsert: true });

  if (result.isErr()) {
    await ctx.respond.fail({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update configuration.")],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(enabled ? Colors.Green : Colors.Grey)
    .setTitle("⚙️ Mention Spam Detection Updated")
    .setDescription(`Mention spam detection is now **${enabled ? "enabled" : "disabled"}**.`)
    .setFooter({ text: "💡 Use /automod status to see full config" });

  if (maxMentions !== null) embed.addFields({ name: "Max Mentions", value: `${maxMentions}`, inline: true });
  if (windowSeconds !== null) embed.addFields({ name: "Window", value: `${windowSeconds}s`, inline: true });
  if (response !== null) embed.addFields({ name: "Action", value: response, inline: true });
  if (timeoutSeconds !== null) embed.addFields({ name: "Timeout Duration", value: `${timeoutSeconds}s`, inline: true });

  await ctx.respond.send({ embeds: [embed] });
}

async function handleSlowmode(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";

  const paths: Record<string, unknown> = { "automod.slowmode.enabled": enabled };

  const messagesPerWindow = interaction.options.getInteger("messages_per_window");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const slowmodeSeconds = interaction.options.getInteger("slowmode_seconds");
  const releaseAfter = interaction.options.getInteger("release_after");

  if (messagesPerWindow !== null) paths["automod.slowmode.messagesPerWindow"] = messagesPerWindow;
  if (windowSeconds !== null) paths["automod.slowmode.windowSeconds"] = windowSeconds;
  if (slowmodeSeconds !== null) paths["automod.slowmode.slowmodeSeconds"] = slowmodeSeconds;
  if (releaseAfter !== null) paths["automod.slowmode.releaseAfterSeconds"] = releaseAfter;

  const result = await updateGuildPaths(guildId, paths, { upsert: true });

  if (result.isErr()) {
    await ctx.respond.fail({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update configuration.")],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(enabled ? Colors.Green : Colors.Grey)
    .setTitle("⚙️ Auto-Slowmode Updated")
    .setDescription(`Automatic slowmode is now **${enabled ? "enabled" : "disabled"}**.`)
    .setFooter({ text: "💡 Use /automod status to see full config" });

  if (messagesPerWindow !== null) embed.addFields({ name: "Trigger", value: `${messagesPerWindow} messages`, inline: true });
  if (windowSeconds !== null) embed.addFields({ name: "Window", value: `${windowSeconds}s`, inline: true });
  if (slowmodeSeconds !== null) embed.addFields({ name: "Slowmode Rate", value: `${slowmodeSeconds}s`, inline: true });
  if (releaseAfter !== null) embed.addFields({ name: "Release After", value: `${releaseAfter}s`, inline: true });

  await ctx.respond.send({ embeds: [embed] });
}

async function handleRaid(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";

  const paths: Record<string, unknown> = { "automod.raidDetection.enabled": enabled };

  const joinsPerMinute = interaction.options.getInteger("joins_per_minute");
  const minAccountAge = interaction.options.getInteger("min_account_age");
  const response = interaction.options.getString("response");
  const reportChannel = interaction.options.getChannel("report_channel");

  if (joinsPerMinute !== null) paths["automod.raidDetection.joinsPerMinute"] = joinsPerMinute;
  if (minAccountAge !== null) paths["automod.raidDetection.minAccountAgeDays"] = minAccountAge;
  if (response !== null) paths["automod.raidDetection.action"] = response;
  if (reportChannel !== undefined) paths["automod.raidDetection.reportChannelId"] = reportChannel?.id ?? null;

  const result = await updateGuildPaths(guildId, paths, { upsert: true });

  if (result.isErr()) {
    await ctx.respond.fail({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update configuration.")],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(enabled ? Colors.Green : Colors.Grey)
    .setTitle("⚙️ Raid Detection Updated")
    .setDescription(`Raid detection is now **${enabled ? "enabled" : "disabled"}**.`)
    .setFooter({ text: "💡 Use /automod status to see full config" });

  if (joinsPerMinute !== null) embed.addFields({ name: "Join Rate", value: `${joinsPerMinute}/min`, inline: true });
  if (minAccountAge !== null) embed.addFields({ name: "Min Account Age", value: `${minAccountAge}d`, inline: true });
  if (response !== null) embed.addFields({ name: "Action", value: response, inline: true });
  if (reportChannel !== undefined) {
    embed.addFields({ name: "Report Channel", value: reportChannel ? `<#${reportChannel.id}>` : "cleared", inline: true });
  }

  await ctx.respond.send({ embeds: [embed] });
}

async function handlePattern(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = ctx.guildId;
  const action = interaction.options.getString("action", true);

  if (action === "list") {
    const guildResult = await getGuild(guildId);
    const guild = guildResult.isOk() ? guildResult.unwrap() : null;
    if (!guild) {
      await ctx.respond.send({ content: "Failed to load config." });
      return;
    }
    const patterns = guild.automod.customPatterns ?? [];
    if (patterns.length === 0) {
      await ctx.respond.send({ content: "No custom patterns configured." });
      return;
    }
    const lines = patterns.map((p, i) => `**${i + 1}. ${p.name}** — \`/${p.pattern}/${p.flags}\` → \`${p.action}\``);
    await ctx.respond.send({ content: lines.join("\n") });
    return;
  }

  const name = interaction.options.getString("name");
  if (!name) {
    await ctx.respond.send({ content: "A pattern name is required." });
    return;
  }

  if (action === "remove") {
    const guildResult = await getGuild(guildId);
    const guild = guildResult.isOk() ? guildResult.unwrap() : null;
    if (!guild) {
      await ctx.respond.send({ content: "Failed to load config." });
      return;
    }
    const patterns = guild.automod.customPatterns ?? [];
    const updated = patterns.filter((p) => p.name !== name);
    if (updated.length === patterns.length) {
      await ctx.respond.send({ content: `No pattern named \`${name}\` found.` });
      return;
    }
    const result = await updateGuildPaths(guildId, { "automod.customPatterns": updated }, { upsert: true });
    if (result.isErr()) {
      await ctx.respond.fail({ content: "Could not remove custom pattern." });
      return;
    }
    const { invalidatePatternCache } = await import("@/features/automod/service");
    invalidatePatternCache(guildId);
    await ctx.respond.send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("🗑️ Pattern Removed")
          .setDescription(`Pattern \`${name}\` has been removed.`),
      ],
    });
    return;
  }

  // add
  const regex = interaction.options.getString("regex");
  if (!regex) {
    await ctx.respond.send({ content: "A regex pattern is required when adding." });
    return;
  }

  const flags = interaction.options.getString("flags") ?? "i";
  const response = (interaction.options.getString("response") ?? "delete") as "delete" | "timeout" | "report";
  const timeoutSeconds = interaction.options.getInteger("timeout_seconds") ?? 300;

  // Validate the regex before saving
  try {
    new RegExp(regex, flags);
  } catch {
    await ctx.respond.send({ content: `Invalid regex: \`/${regex}/${flags}\`` });
    return;
  }

  const guildResult = await getGuild(guildId);
  const guild = guildResult.isOk() ? guildResult.unwrap() : null;
  if (!guild) {
    await ctx.respond.send({ content: "Failed to load config." });
    return;
  }

  const patterns = guild.automod.customPatterns ?? [];
  if (patterns.some((p) => p.name === name)) {
    await ctx.respond.send({ content: `A pattern named \`${name}\` already exists. Remove it first.` });
    return;
  }

  const updated = [...patterns, { name, pattern: regex, flags, action: response, timeoutSeconds }];
  const result = await updateGuildPaths(guildId, { "automod.customPatterns": updated }, { upsert: true });
  if (result.isErr()) {
    await ctx.respond.fail({ content: "Could not add custom pattern." });
    return;
  }
  const { invalidatePatternCache } = await import("@/features/automod/service");
  invalidatePatternCache(guildId);

  await ctx.respond.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Pattern Added")
        .setDescription(`Pattern \`${name}\` has been added.`)
        .addFields(
          { name: "Regex", value: `\`/${regex}/${flags}\``, inline: true },
          { name: "Action", value: response, inline: true },
        ),
    ],
  });
}

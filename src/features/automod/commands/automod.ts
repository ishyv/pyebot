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
import { updateGuildPaths } from "@/db/repositories/guilds";
import { getGuild } from "@/db/repositories/guilds";

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
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "linkspam") await handleLinkspam(interaction);
  else if (sub === "whitelist") await handleWhitelist(interaction);
  else if (sub === "report-channel") await handleReportChannel(interaction);
  else if (sub === "status") await handleStatus(interaction);
}

async function handleLinkspam(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";

  const paths: Record<string, unknown> = { "automod.linkSpam.enabled": enabled };

  const maxLinks = interaction.options.getInteger("max_links");
  const windowSeconds = interaction.options.getInteger("window_seconds");
  const response = interaction.options.getString("response");

  if (maxLinks !== null) paths["automod.linkSpam.maxLinks"] = maxLinks;
  if (windowSeconds !== null) paths["automod.linkSpam.windowSeconds"] = windowSeconds;
  if (response !== null) paths["automod.linkSpam.action"] = response;

  const result = await updateGuildPaths(guildId, paths);

  if (result.isErr()) {
    await interaction.editReply({
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

  await interaction.editReply({ embeds: [embed] });
}

async function handleWhitelist(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const action = interaction.options.getString("action", true);
  const domain = interaction.options.getString("domain", true).toLowerCase().trim();

  const guildResult = await getGuild(guildId);
  if (guildResult.isErr()) {
    await interaction.editReply({ content: "Failed to load guild config." });
    return;
  }

  const current = guildResult.unwrap()?.automod.domainWhitelist.domains ?? [];

  let updated: string[];
  if (action === "add") {
    if (current.includes(domain)) {
      await interaction.editReply({ content: `\`${domain}\` is already whitelisted.` });
      return;
    }
    updated = [...current, domain];
  } else {
    updated = current.filter((d) => d !== domain);
    if (updated.length === current.length) {
      await interaction.editReply({ content: `\`${domain}\` is not in the whitelist.` });
      return;
    }
  }

  await updateGuildPaths(guildId, {
    "automod.domainWhitelist.enabled": true,
    "automod.domainWhitelist.domains": updated,
  });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(action === "add" ? Colors.Green : Colors.Orange)
        .setTitle(`${action === "add" ? "✅ Domain Added" : "🗑️ Domain Removed"}`)
        .setDescription(`\`${domain}\` has been ${action === "add" ? "added to" : "removed from"} the whitelist.`)
        .addFields({ name: "Total Entries", value: `${updated.length}`, inline: true }),
    ],
  });
}

async function handleReportChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const channel = interaction.options.getChannel("channel");
  const channelId = channel?.id ?? null;

  const result = await updateGuildPaths(guildId, {
    "automod.linkSpam.reportChannelId": channelId,
  });

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription("Could not update report channel.")],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle("⚙️ Report Channel Updated")
        .setDescription(channelId ? `Automod reports will be sent to <#${channelId}>.` : "Report channel cleared — reports are disabled."),
    ],
  });
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const guildResult = await getGuild(guildId);

  if (guildResult.isErr() || !guildResult.unwrap()) {
    await interaction.editReply({ content: "Failed to load config." });
    return;
  }

  const automod = guildResult.unwrap()!.automod;
  const ls = automod.linkSpam;
  const dw = automod.domainWhitelist;

  const lines = [
    `**Link Spam:** ${ls.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Max links: ${ls.maxLinks} per ${ls.windowSeconds}s | Action: \`${ls.action}\``,
    `  Report channel: ${ls.reportChannelId ? `<#${ls.reportChannelId}>` : "none"}`,
    `**Domain Whitelist:** ${dw.enabled ? "✅ Enabled" : "❌ Disabled"}`,
    `  Domains: ${dw.domains.length > 0 ? dw.domains.join(", ") : "none"}`,
  ];

  await interaction.editReply({ content: lines.join("\n") });
}

/**
 * /modconfig — Admin configuration for moderation settings.
 *
 * Subcommands:
 *   modlog         — Set the mod log channel
 *   restrict-roles — Configure roles for restriction types
 *   escalation     — Enable/disable auto-escalation + warn threshold
 *
 * Note: Duration parsing for escalation is deferred to Phase 4b when
 * parseDuration utility is implemented. For now only threshold is stored.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  ChannelType,
  type ChatInputCommandInteraction,
} from "discord.js";
import { updateGuildPaths } from "@/db/repositories/guilds";

export const data = new SlashCommandBuilder()
  .setName("modconfig")
  .setDescription("Configure moderation settings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("modlog")
      .setDescription("Set the channel for moderation action logs")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("Text channel for mod logs").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("restrict-roles")
      .setDescription("Set a role for a restriction type")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Restriction area")
          .setRequired(true)
          .addChoices(
            { name: "Forums", value: "forums" },
            { name: "Voice", value: "voice" },
            { name: "Jobs", value: "jobs" },
            { name: "All areas", value: "all" },
          ),
      )
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("Role to assign when restricted").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("escalation")
      .setDescription("Configure auto-escalation settings")
      .addStringOption((opt) =>
        opt
          .setName("action")
          .setDescription("Enable or disable escalation")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("threshold")
          .setDescription("Number of warns before auto-mute (default: 3)")
          .setMinValue(1)
          .setMaxValue(20)
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Auto-mute duration (e.g. 1h, 30m, 1d) — wired in Phase 4b")
          .setRequired(false),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "modlog") await handleModlog(interaction);
  else if (sub === "restrict-roles") await handleRestrictRoles(interaction);
  else if (sub === "escalation") await handleEscalation(interaction);
}

async function handleModlog(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  // Verify it's a text channel
  if (channel.type !== ChannelType.GuildText) {
    await interaction.editReply({ content: "The channel must be a text channel." });
    return;
  }

  const result = await updateGuildPaths(interaction.guild.id, {
    "channels.core.modlog": { channelId: channel.id },
  });

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("Failed")
          .setDescription("Could not update mod log channel."),
      ],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("Mod Log Channel Set")
        .setDescription(`Mod log channel set to <#${channel.id}>.`),
    ],
  });
}

async function handleRestrictRoles(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const type = interaction.options.getString("type", true) as "forums" | "voice" | "jobs" | "all";
  const role = interaction.options.getRole("role", true);

  const result = await updateGuildPaths(interaction.guild.id, {
    [`moderation.restrictionRoles.${type}`]: role.id,
  });

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("Failed")
          .setDescription("Could not update restriction role."),
      ],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("Restriction Role Set")
        .setDescription(`Restriction role for **${type}** set to <@&${role.id}>.`),
    ],
  });
}

async function handleEscalation(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const threshold = interaction.options.getInteger("threshold");
  // Duration parsing is deferred to Phase 4b — accept the string but do not persist it yet
  const _duration = interaction.options.getString("duration");

  const paths: Record<string, unknown> = {
    "moderation.escalation.enabled": enabled,
  };

  if (threshold !== null) {
    paths["moderation.escalation.warnThreshold"] = threshold;
  }

  const result = await updateGuildPaths(interaction.guild.id, paths);

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("Failed")
          .setDescription("Could not update escalation settings."),
      ],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(enabled ? Colors.Green : Colors.Grey)
    .setTitle("Escalation Settings Updated")
    .setDescription(`Auto-escalation is now **${enabled ? "enabled" : "disabled"}**.`);

  if (threshold !== null) {
    embed.addFields({ name: "Warn Threshold", value: `${threshold}`, inline: true });
  }

  if (_duration) {
    embed.addFields({ name: "Duration", value: `${_duration} *(will be applied in Phase 4b)*`, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

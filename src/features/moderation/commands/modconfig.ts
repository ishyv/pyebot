import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
/**
 * /modconfig — Admin configuration for moderation settings.
 *
 * Subcommands:
 *   modlog         — Set the mod log channel
 *   restrict-roles — Configure roles for restriction types
 *   escalation     — Enable/disable auto-escalation + warn threshold + mute duration
 */

import { ChannelType, type ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { updateGuildPaths } from "@/db/repositories/guilds";
import { container, separator, text, v2Message } from "@/ui/v2";
import { parseDuration } from "@/utils/duration";
import { msToHuman } from "@/utils/time";

const data = command("modconfig")
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
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
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

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "modlog") await handleModlog(interaction, ctx);
  else if (sub === "restrict-roles") await handleRestrictRoles(interaction, ctx);
  else if (sub === "escalation") await handleEscalation(interaction, ctx);
}

async function handleModlog(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  // Verify it's a text channel
  if (channel.type !== ChannelType.GuildText) {
    await ctx.respond.send({ content: "The channel must be a text channel." });
    return;
  }

  const result = await updateGuildPaths(interaction.guild.id, {
    "channels.core.modlog": { channelId: channel.id },
  });

  if (result.isErr()) {
    await ctx.respond.send(
      v2Message(container("danger", text("## Failed\nCould not update mod log channel."))),
    );
    return;
  }

  await ctx.respond.send(
    v2Message(
      container("ok", text(`## Mod Log Channel Set\nMod log channel set to <#${channel.id}>.`)),
    ),
  );
}

async function handleRestrictRoles(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const type = interaction.options.getString("type", true) as "forums" | "voice" | "jobs" | "all";
  const role = interaction.options.getRole("role", true);

  const result = await updateGuildPaths(interaction.guild.id, {
    [`moderation.restrictionRoles.${type}`]: role.id,
  });

  if (result.isErr()) {
    await ctx.respond.send(
      v2Message(container("danger", text("## Failed\nCould not update restriction role."))),
    );
    return;
  }

  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(`## Restriction Role Set\nRestriction role for **${type}** set to <@&${role.id}>.`),
      ),
    ),
  );
}

async function handleEscalation(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const action = interaction.options.getString("action", true);
  const enabled = action === "enable";
  const threshold = interaction.options.getInteger("threshold");
  const durationStr = interaction.options.getString("duration");

  // Validate duration if provided
  let durationMs: number | null = null;
  if (durationStr !== null) {
    durationMs = parseDuration(durationStr);
    if (durationMs === null) {
      await ctx.respond.send(
        v2Message(
          container(
            "danger",
            text(
              "## Invalid Duration\nInvalid duration. Valid formats: 10s, 5m, 2h, 3d, 1w (maximum 28 days)",
            ),
          ),
        ),
      );
      return;
    }
  }

  const paths: Record<string, unknown> = {
    "moderation.escalation.enabled": enabled,
  };

  if (threshold !== null) {
    paths["moderation.escalation.warnThreshold"] = threshold;
  }

  if (durationMs !== null) {
    paths["moderation.escalation.muteDurationMs"] = durationMs;
  }

  const result = await updateGuildPaths(interaction.guild.id, paths);

  if (result.isErr()) {
    await ctx.respond.send(
      v2Message(container("danger", text("## Failed\nCould not update escalation settings."))),
    );
    return;
  }

  const escalationLines = [
    threshold !== null ? `**Warn Threshold:** ${threshold}` : null,
    durationMs !== null ? `**Mute Duration:** ${msToHuman(durationMs)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.respond.send(
    v2Message(
      container(
        enabled ? "ok" : "mute",
        text(
          `## Escalation Settings Updated\nAuto-escalation is now **${enabled ? "enabled" : "disabled"}**.`,
        ),
        ...(escalationLines ? [separator("sm"), text(escalationLines)] : []),
      ),
    ),
  );
}

export default data
  .help({ hints: ["/modset status", "/mod help"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

/**
 * /modconfig — Admin configuration for moderation settings.
 *
 * Subcommands:
 *   modlog         — Set the mod log channel
 *   restrict-roles — Configure roles for restriction types
 *   escalation     — Enable/disable auto-escalation + warn threshold + mute duration
 */

import { ChannelType, PermissionFlagsBits } from "discord.js";
import { updateGuildPaths } from "@/db/repositories/guilds";
import { command } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";
import { parseDuration } from "@/utils/duration";
import { msToHuman } from "@/utils/time";

export default command("modconfig")
  .description("Configure moderation settings")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .guildOnly()
  .defer("ephemeral")
  .subcommand("modlog", "Set the channel for moderation action logs", (s) =>
    s.channel("channel", "Text channel for mod logs", { required: true }),
  )
  .subcommand("restrict-roles", "Set a role for a restriction type", (s) =>
    s
      .string("type", "Restriction area", {
        required: true,
        choices: [
          { name: "Forums", value: "forums" },
          { name: "Voice", value: "voice" },
          { name: "Jobs", value: "jobs" },
          { name: "All areas", value: "all" },
        ],
      })
      .role("role", "Role to assign when restricted", { required: true }),
  )
  .subcommand("escalation", "Configure auto-escalation settings", (s) =>
    s
      .string("action", "Enable or disable escalation", {
        required: true,
        choices: [
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ],
      })
      .integer("threshold", "Number of warns before auto-mute (default: 3)", {
        min: 1,
        max: 20,
      })
      .string("duration", "Auto-mute duration (e.g. 1h, 30m, 1d) — wired in Phase 4b"),
  )
  .help({ hints: ["/modset status", "/mod help"] })
  .handle("modlog", async (c) => {
    const channel = c.options.channel;
    if (channel.type !== ChannelType.GuildText) {
      return { content: "The channel must be a text channel." };
    }
    const result = await updateGuildPaths(c.guildId, {
      "channels.core.modlog": { channelId: channel.id },
    });
    if (result.isErr()) {
      return v2Message(container("danger", text("## Failed\nCould not update mod log channel.")));
    }
    return v2Message(
      container("ok", text(`## Mod Log Channel Set\nMod log channel set to <#${channel.id}>.`)),
    );
  })
  .handle("restrict-roles", async (c) => {
    const type = c.options.type as "forums" | "voice" | "jobs" | "all";
    const role = c.options.role;
    const result = await updateGuildPaths(c.guildId, {
      [`moderation.restrictionRoles.${type}`]: role.id,
    });
    if (result.isErr()) {
      return v2Message(container("danger", text("## Failed\nCould not update restriction role.")));
    }
    return v2Message(
      container(
        "ok",
        text(`## Restriction Role Set\nRestriction role for **${type}** set to <@&${role.id}>.`),
      ),
    );
  })
  .handle("escalation", async (c) => {
    const enabled = c.options.action === "enable";
    const threshold = c.options.threshold;
    const durationStr = c.options.duration;

    let durationMs: number | null = null;
    if (durationStr !== null) {
      durationMs = parseDuration(durationStr);
      if (durationMs === null) {
        return v2Message(
          container(
            "danger",
            text(
              "## Invalid Duration\nInvalid duration. Valid formats: 10s, 5m, 2h, 3d, 1w (maximum 28 days)",
            ),
          ),
        );
      }
    }

    const paths: Record<string, unknown> = { "moderation.escalation.enabled": enabled };
    if (threshold !== null) paths["moderation.escalation.warnThreshold"] = threshold;
    if (durationMs !== null) paths["moderation.escalation.muteDurationMs"] = durationMs;

    const result = await updateGuildPaths(c.guildId, paths);
    if (result.isErr()) {
      return v2Message(
        container("danger", text("## Failed\nCould not update escalation settings.")),
      );
    }

    const escalationLines = [
      threshold !== null ? `**Warn Threshold:** ${threshold}` : null,
      durationMs !== null ? `**Mute Duration:** ${msToHuman(durationMs)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return v2Message(
      container(
        enabled ? "ok" : "mute",
        text(
          `## Escalation Settings Updated\nAuto-escalation is now **${enabled ? "enabled" : "disabled"}**.`,
        ),
        ...(escalationLines ? [separator("sm"), text(escalationLines)] : []),
      ),
    );
  });

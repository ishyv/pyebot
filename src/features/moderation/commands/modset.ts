/**
 * /modset — configure the moderation feature.
 *
 * Subcommands:
 *   log-channel        set the mod log channel
 *   appeals-channel    set the ban appeals channel
 *   escalation add     add a warn threshold → auto-action
 *   escalation clear   remove all escalation thresholds
 *   escalation list    show all thresholds
 *   escalation toggle  enable/disable escalation
 *   quarantine role    set the quarantine role
 *   quarantine channel set the quarantine review channel
 *   quarantine toggle  enable/disable quarantine
 *   verify toggle      enable/disable verification gate
 *   verify mode        configure the verification gate mode
 *   verify channel     channel where verify prompt is posted
 *   verify role        role granted on verification pass
 *   verify min-age     minimum account age in days
 *   alt-detection      enable/disable alt account detection
 *   status             show all current config
 *   panel              open the moderation configuration panel
 */

import { PermissionFlagsBits } from "discord.js";
import { getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import { DURATION_MAP } from "@/features/moderation/service";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("modset")
  .description("Configure moderation settings")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .guildOnly()
  .defer("ephemeral")
  // ── Top-level subcommands ──────────────────────────────────────────────────
  .subcommand("log-channel", "Set the channel where all mod actions are logged", (s) =>
    s.channel("channel", "Log channel (omit to clear)"),
  )
  .subcommand("appeals-channel", "Set the channel where ban appeal threads are created", (s) =>
    s.channel("channel", "Appeals channel (omit to clear)"),
  )
  .subcommand("alt-detection", "Enable or disable alt account detection alerts", (s) =>
    s.string("action", "Enable or disable", {
      required: true,
      choices: [
        { name: "Enable", value: "enable" },
        { name: "Disable", value: "disable" },
      ],
    }),
  )
  .subcommand("status", "Show full moderation configuration")
  .subcommand("panel", "Open the moderation configuration panel")
  // ── Escalation group ───────────────────────────────────────────────────────
  .group("escalation", "Configure automatic punishment escalation on warns", (g) =>
    g
      .subcommand("add", "Add an escalation threshold", (s) =>
        s
          .integer("warns", "Number of warns that triggers this action", { required: true, min: 1 })
          .string("action", "Action to take", {
            required: true,
            choices: [
              { name: "Timeout", value: "timeout" },
              { name: "Kick", value: "kick" },
              { name: "Ban", value: "ban" },
            ],
          })
          .string("duration", "Timeout duration (required when action is Timeout)", {
            choices: Object.keys(DURATION_MAP).map((d) => ({ name: d, value: d })),
          }),
      )
      .subcommand("clear", "Remove all escalation thresholds")
      .subcommand("list", "Show current escalation thresholds")
      .subcommand("toggle", "Enable or disable escalation", (s) =>
        s.string("action", "Enable or disable", {
          required: true,
          choices: [
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ],
        }),
      )
      .handle("add", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const guildId = c.guildId;
        const { warns: warnCount, action, duration: durationKey } = c.options;
        if (action === "timeout" && !durationKey) {
          return { content: "A duration is required when the action is Timeout." };
        }
        const guildResult = await getGuild(guildId);
        if (guildResult.isErr()) return { content: "Failed to load config." };
        const existing = guildResult.unwrap()?.moderation.escalation.thresholds ?? [];
        if (existing.some((t) => t.warnCount === warnCount)) {
          return {
            content: `A threshold for **${warnCount} warns** already exists. Delete the old one first.`,
          };
        }
        const updated = [
          ...existing,
          { warnCount, action, ...(durationKey ? { durationKey } : {}) },
        ];
        await updateGuildPaths(guildId, { "moderation.escalation.thresholds": updated });
        const label =
          action === "timeout"
            ? `Timeout ${durationKey}`
            : action.charAt(0).toUpperCase() + action.slice(1);
        return { content: `Threshold added: **${warnCount} warns → ${label}**.` };
      })
      .handle("clear", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        await updateGuildPaths(c.guildId, { "moderation.escalation.thresholds": [] });
        return { content: "All escalation thresholds cleared." };
      })
      .handle("list", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const guildResult = await getGuild(c.guildId);
        if (guildResult.isErr()) return { content: "Failed to load config." };
        const { enabled, thresholds } = guildResult.unwrap()?.moderation.escalation ?? {
          enabled: false,
          thresholds: [],
        };
        if (thresholds.length === 0) {
          return {
            content: `Escalation is **${enabled ? "enabled" : "disabled"}** — no thresholds configured.`,
          };
        }
        const lines = thresholds
          .sort((a, b) => a.warnCount - b.warnCount)
          .map((t) => {
            const label =
              t.action === "timeout"
                ? `Timeout ${t.durationKey}`
                : t.action.charAt(0).toUpperCase() + t.action.slice(1);
            return `• **${t.warnCount} warns** → ${label}`;
          });
        return {
          content: `**Escalation** (${enabled ? "✅ on" : "❌ off"})\n${lines.join("\n")}`,
        };
      })
      .handle("toggle", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const enabled = c.options.action === "enable";
        await updateGuildPaths(c.guildId, { "moderation.escalation.enabled": enabled });
        return { content: `Escalation is now **${enabled ? "enabled" : "disabled"}**.` };
      }),
  )
  // ── Quarantine group ───────────────────────────────────────────────────────
  .group("quarantine", "Configure the quarantine role system", (g) =>
    g
      .subcommand("role", "Set the quarantine role", (s) =>
        s.role("role", "Quarantine role (omit to clear)"),
      )
      .subcommand("channel", "Set the review channel for quarantined users", (s) =>
        s.channel("channel", "Review channel (omit to clear)"),
      )
      .subcommand("toggle", "Enable or disable the quarantine system", (s) =>
        s.string("action", "Enable or disable", {
          required: true,
          choices: [
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ],
        }),
      )
      .handle("role", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const role = c.options.role;
        await updateGuildPaths(c.guildId, { "moderation.quarantine.roleId": role?.id ?? null });
        return {
          content: role ? `Quarantine role set to <@&${role.id}>.` : "Quarantine role cleared.",
        };
      })
      .handle("channel", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const channel = c.options.channel;
        await updateGuildPaths(c.guildId, {
          "moderation.quarantine.channelId": channel?.id ?? null,
        });
        return {
          content: channel
            ? `Quarantine channel set to <#${channel.id}>.`
            : "Quarantine channel cleared.",
        };
      })
      .handle("toggle", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const enabled = c.options.action === "enable";
        await updateGuildPaths(c.guildId, { "moderation.quarantine.enabled": enabled });
        return { content: `Quarantine is now **${enabled ? "enabled" : "disabled"}**.` };
      }),
  )
  // ── Verify group ───────────────────────────────────────────────────────────
  .group("verify", "Configure the member verification gate", (g) =>
    g
      .subcommand("toggle", "Enable or disable the verification gate", (s) =>
        s.string("action", "Enable or disable", {
          required: true,
          choices: [
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ],
        }),
      )
      .subcommand("mode", "Set how new members verify", (s) =>
        s.string("mode", "Verification mode", {
          required: true,
          choices: [
            { name: "Button (click to verify)", value: "button" },
            { name: "Account age gate (auto-kick if too new)", value: "account_age" },
          ],
        }),
      )
      .subcommand("channel", "Channel where the verify prompt is posted", (s) =>
        s.channel("channel", "Verify channel (omit to clear)"),
      )
      .subcommand("role", "Role granted when a member passes verification", (s) =>
        s.role("role", "Verified role (omit to clear)"),
      )
      .subcommand("min-age", "Minimum account age in days (0 = no minimum)", (s) =>
        s.integer("days", "Days", { required: true, min: 0, max: 365 }),
      )
      .handle("toggle", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const enabled = c.options.action === "enable";
        await updateGuildPaths(c.guildId, { "moderation.verification.enabled": enabled });
        return {
          content: `Verification gate is now **${enabled ? "enabled" : "disabled"}**.`,
        };
      })
      .handle("mode", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        await updateGuildPaths(c.guildId, { "moderation.verification.mode": c.options.mode });
        return { content: `Verification mode set to **${c.options.mode}**.` };
      })
      .handle("channel", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const channel = c.options.channel;
        await updateGuildPaths(c.guildId, {
          "moderation.verification.channelId": channel?.id ?? null,
        });
        return {
          content: channel ? `Verify channel set to <#${channel.id}>.` : "Verify channel cleared.",
        };
      })
      .handle("role", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const role = c.options.role;
        await updateGuildPaths(c.guildId, { "moderation.verification.roleId": role?.id ?? null });
        return {
          content: role ? `Verified role set to <@&${role.id}>.` : "Verified role cleared.",
        };
      })
      .handle("min-age", async (c) => {
        if (!c.guildId) return; // unreachable: command is .guildOnly()
        const days = c.options.days;
        await updateGuildPaths(c.guildId, { "moderation.verification.minAccountAgeDays": days });
        return {
          content: `Minimum account age set to **${days} day${days === 1 ? "" : "s"}**.`,
        };
      }),
  )
  .help({ hints: ["/modconfig modlog", "/mod help"] })
  // ── Top-level handlers ─────────────────────────────────────────────────────
  .handle("log-channel", async (c) => {
    const channel = c.options.channel;
    await updateGuildPaths(c.guildId, { "moderation.modLogChannelId": channel?.id ?? null });
    return {
      content: channel ? `Mod log set to <#${channel.id}>.` : "Mod log channel cleared.",
    };
  })
  .handle("appeals-channel", async (c) => {
    const channel = c.options.channel;
    await updateGuildPaths(c.guildId, { "moderation.appealsChannelId": channel?.id ?? null });
    return {
      content: channel ? `Appeals channel set to <#${channel.id}>.` : "Appeals channel cleared.",
    };
  })
  .handle("alt-detection", async (c) => {
    const enabled = c.options.action === "enable";
    await updateGuildPaths(c.guildId, { "moderation.altDetectionEnabled": enabled });
    return { content: `Alt detection is now **${enabled ? "enabled" : "disabled"}**.` };
  })
  .handle("status", async (c) => {
    const guildResult = await getGuild(c.guildId);
    const guildData = guildResult.isErr() ? null : guildResult.unwrap();
    if (!guildData) return { content: "Failed to load config." };
    const { moderation: cfg } = guildData;
    const esc = cfg.escalation;
    const q = cfg.quarantine;
    const v = cfg.verification;

    const lines = [
      `**Mod Log:** ${cfg.modLogChannelId ? `<#${cfg.modLogChannelId}>` : "not set"}`,
      `**Appeals:** ${cfg.appealsChannelId ? `<#${cfg.appealsChannelId}>` : "not set"}`,
      `**Alt Detection:** ${cfg.altDetectionEnabled ? "✅ on" : "❌ off"}`,
      "",
      `**Escalation:** ${esc.enabled ? "✅ on" : "❌ off"} — ${esc.thresholds.length} threshold(s)`,
      ...esc.thresholds
        .sort((a, b) => a.warnCount - b.warnCount)
        .map(
          (t) =>
            `  • ${t.warnCount} warns → ${t.action === "timeout" ? `timeout ${t.durationKey}` : t.action}`,
        ),
      "",
      `**Quarantine:** ${q.enabled ? "✅ on" : "❌ off"}`,
      `  Role: ${q.roleId ? `<@&${q.roleId}>` : "not set"} | Channel: ${q.channelId ? `<#${q.channelId}>` : "not set"}`,
      "",
      `**Verification Gate:** ${v.enabled ? "✅ on" : "❌ off"} (mode: ${v.mode})`,
      `  Channel: ${v.channelId ? `<#${v.channelId}>` : "not set"} | Role: ${v.roleId ? `<@&${v.roleId}>` : "not set"}`,
      `  Min account age: ${v.minAccountAgeDays}d | Kick on fail: ${v.kickOnFail ? "yes" : "no"}`,
    ];

    return v2Message(container("info", text(`## Moderation Config\n${lines.join("\n")}`)));
  })
  // ── Panel fallthrough ──────────────────────────────────────────────────────
  .run(async (c) => {
    if (!(await assertPanelPermission(c.interaction))) return;
    await openAdminPanel(c.interaction, "moderation");
  });

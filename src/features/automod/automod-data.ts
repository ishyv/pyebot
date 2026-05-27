import { PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";

/** Slash-command definition for `/automod`; execution lives in subcommand handlers. */
export const data = command("automod")
  .description("Configure automatic moderation")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .subcommand("linkspam", "Configure link spam detection", (s) =>
    s
      .string("action", "Enable or disable link spam detection", {
        required: true,
        choices: [
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ],
      })
      .integer("max_links", "Max links per window (default 4)", { min: 1, max: 20 })
      .integer("window_seconds", "Window in seconds (default 10)", { min: 5, max: 120 })
      .string("response", "What to do when triggered (default: timeout)", {
        choices: [
          { name: "Timeout", value: "timeout" },
          { name: "Delete", value: "delete" },
          { name: "Report only", value: "report" },
        ],
      }),
  )
  .subcommand("whitelist", "Manage domain whitelist", (s) =>
    s
      .string("action", "Add or remove a domain", {
        required: true,
        choices: [
          { name: "Add", value: "add" },
          { name: "Remove", value: "remove" },
        ],
      })
      .string("domain", "Domain to add/remove (e.g. example.com)", { required: true }),
  )
  .subcommand("report-channel", "Set the channel where automod reports are sent", (s) =>
    s.channel("channel", "Report channel (omit to clear)"),
  )
  .subcommand("status", "Show current automod configuration")
  .subcommand("mentionspam", "Configure mention spam detection", (s) =>
    s
      .string("action", "Enable or disable mention spam detection", {
        required: true,
        choices: [
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ],
      })
      .integer("max_mentions", "Max mentions per message/window (default 5)", { min: 1, max: 50 })
      .integer("window_seconds", "Window in seconds (default 10)", { min: 5, max: 120 })
      .string("response", "What to do when triggered (default: timeout)", {
        choices: [
          { name: "Timeout", value: "timeout" },
          { name: "Delete", value: "delete" },
          { name: "Report only", value: "report" },
        ],
      })
      .integer("timeout_seconds", "Timeout duration in seconds (default 600)", {
        min: 60,
        max: 604800,
      }),
  )
  .subcommand("slowmode", "Configure automatic slowmode on message spikes", (s) =>
    s
      .string("action", "Enable or disable automatic slowmode", {
        required: true,
        choices: [
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ],
      })
      .integer("messages_per_window", "Messages to trigger slowmode (default 20)", {
        min: 5,
        max: 200,
      })
      .integer("window_seconds", "Detection window in seconds (default 60)", { min: 10, max: 300 })
      .integer("slowmode_seconds", "Slowmode rate limit to apply (default 5)", {
        min: 1,
        max: 21600,
      })
      .integer("release_after", "Seconds before slowmode is lifted (default 60)", {
        min: 10,
        max: 3600,
      }),
  )
  .subcommand("raid", "Configure raid detection", (s) =>
    s
      .string("action", "Enable or disable raid detection", {
        required: true,
        choices: [
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ],
      })
      .integer("joins_per_minute", "Join rate to trigger detection (default 10)", {
        min: 3,
        max: 100,
      })
      .integer("min_account_age", "Account age in days considered 'new' (default 7)", {
        min: 0,
        max: 30,
      })
      .string("response", "Action to take on raid detection (default: alert)", {
        choices: [
          { name: "Alert only", value: "alert" },
          { name: "Lockdown server", value: "lockdown" },
        ],
      })
      .channel("report_channel", "Channel to send raid alerts (omit to clear)"),
  )
  .subcommand("pattern", "Manage custom regex patterns", (s) =>
    s
      .string("action", "Add, remove, or list patterns", {
        required: true,
        choices: [
          { name: "Add", value: "add" },
          { name: "Remove", value: "remove" },
          { name: "List", value: "list" },
        ],
      })
      .string("name", "Pattern name (required for add/remove)")
      .string("regex", "Regex pattern (required for add)")
      .string("flags", "Regex flags (default: i)")
      .string("response", "Action when pattern matches (default: delete)", {
        choices: [
          { name: "Delete", value: "delete" },
          { name: "Timeout", value: "timeout" },
          { name: "Report only", value: "report" },
        ],
      })
      .integer("timeout_seconds", "Timeout duration in seconds (default 300)", {
        min: 60,
        max: 604800,
      }),
  )
  .subcommand("crosschannel", "Configure cross-channel spam bot detection", (s) =>
    s
      .string("action", "Enable or disable cross-channel spam detection", {
        required: true,
        choices: [
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ],
      })
      .integer("min_channels", "Unique channels required to trigger (default 3)", {
        min: 2,
        max: 20,
      })
      .integer("window_seconds", "Detection window in seconds (default 30)", { min: 5, max: 300 })
      .channel("report_channel", "Channel to send mod alerts (omit to clear)")
      .boolean("auto_timeout", "Auto-timeout the user on detection (default true)")
      .integer(
        "timeout_seconds",
        "Timeout duration in seconds when auto-timeout fires (default 3600)",
        {
          min: 60,
          max: 604800,
        },
      ),
  )
  .subcommand("policy", "Configure tiered AutoMod policy", (s) =>
    s
      .string("preset", "Evidence threshold preset", {
        choices: [
          { name: "Relaxed", value: "relaxed" },
          { name: "Balanced", value: "balanced" },
          { name: "Strict", value: "strict" },
        ],
      })
      .boolean("ai_detector", "Enable optional AI detector signal plumbing")
      .boolean("staff_bypass", "Allow staff with Manage Messages to bypass AutoMod")
      .integer("retention_days", "Rolling profile retention in days", { min: 1, max: 365 }),
  )
  .subcommand("image-add", "Add a banned image fingerprint", (s) =>
    s
      .attachment("image", "Image attachment to ban", { required: true })
      .string("reason", "Why this image should be removed", { required: true, max: 240 })
      .string("label", "Short optional label", { max: 80 }),
  )
  .subcommand("image-list", "List active banned image fingerprints")
  .subcommand("image-remove", "Remove a banned image fingerprint", (s) =>
    s.string("id", "Banned image id from image-list", { required: true }),
  )
  .subcommand("image-toggle", "Enable or disable banned-image detection", (s) =>
    s.string("action", "Enable or disable image detection", {
      required: true,
      choices: [
        { name: "Enable", value: "enable" },
        { name: "Disable", value: "disable" },
      ],
    }),
  )
  .subcommand("image-channel", "Set the banned-image report channel", (s) =>
    s.channel("channel", "Report channel (omit to clear)"),
  )
  .subcommand("panel", "Open the automod configuration panel");

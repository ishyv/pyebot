import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

/** Slash-command definition for `/automod`; execution lives in subcommand handlers. */
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
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
      )
      .addIntegerOption((o) =>
        o
          .setName("max_links")
          .setDescription("Max links per window (default 4)")
          .setMinValue(1)
          .setMaxValue(20),
      )
      .addIntegerOption((o) =>
        o
          .setName("window_seconds")
          .setDescription("Window in seconds (default 10)")
          .setMinValue(5)
          .setMaxValue(120),
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
          .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" }),
      )
      .addStringOption((o) =>
        o
          .setName("domain")
          .setDescription("Domain to add/remove (e.g. example.com)")
          .setRequired(true),
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
    sub.setName("status").setDescription("Show current automod configuration"),
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
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
      )
      .addIntegerOption((o) =>
        o
          .setName("max_mentions")
          .setDescription("Max mentions per message/window (default 5)")
          .setMinValue(1)
          .setMaxValue(50),
      )
      .addIntegerOption((o) =>
        o
          .setName("window_seconds")
          .setDescription("Window in seconds (default 10)")
          .setMinValue(5)
          .setMaxValue(120),
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
        o
          .setName("timeout_seconds")
          .setDescription("Timeout duration in seconds (default 600)")
          .setMinValue(60)
          .setMaxValue(604800),
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
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
      )
      .addIntegerOption((o) =>
        o
          .setName("messages_per_window")
          .setDescription("Messages to trigger slowmode (default 20)")
          .setMinValue(5)
          .setMaxValue(200),
      )
      .addIntegerOption((o) =>
        o
          .setName("window_seconds")
          .setDescription("Detection window in seconds (default 60)")
          .setMinValue(10)
          .setMaxValue(300),
      )
      .addIntegerOption((o) =>
        o
          .setName("slowmode_seconds")
          .setDescription("Slowmode rate limit to apply (default 5)")
          .setMinValue(1)
          .setMaxValue(21600),
      )
      .addIntegerOption((o) =>
        o
          .setName("release_after")
          .setDescription("Seconds before slowmode is lifted (default 60)")
          .setMinValue(10)
          .setMaxValue(3600),
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
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
      )
      .addIntegerOption((o) =>
        o
          .setName("joins_per_minute")
          .setDescription("Join rate to trigger detection (default 10)")
          .setMinValue(3)
          .setMaxValue(100),
      )
      .addIntegerOption((o) =>
        o
          .setName("min_account_age")
          .setDescription("Account age in days considered 'new' (default 7)")
          .setMinValue(0)
          .setMaxValue(30),
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
      .addStringOption((o) => o.setName("regex").setDescription("Regex pattern (required for add)"))
      .addStringOption((o) => o.setName("flags").setDescription("Regex flags (default: i)"))
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
        o
          .setName("timeout_seconds")
          .setDescription("Timeout duration in seconds (default 300)")
          .setMinValue(60)
          .setMaxValue(604800),
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
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
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
        o
          .setName("auto_timeout")
          .setDescription("Auto-timeout the user on detection (default true)"),
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
      .setName("policy")
      .setDescription("Configure tiered AutoMod policy")
      .addStringOption((o) =>
        o
          .setName("preset")
          .setDescription("Evidence threshold preset")
          .addChoices(
            { name: "Relaxed", value: "relaxed" },
            { name: "Balanced", value: "balanced" },
            { name: "Strict", value: "strict" },
          ),
      )
      .addBooleanOption((o) =>
        o.setName("ai_detector").setDescription("Enable optional AI detector signal plumbing"),
      )
      .addBooleanOption((o) =>
        o
          .setName("staff_bypass")
          .setDescription("Allow staff with Manage Messages to bypass AutoMod"),
      )
      .addIntegerOption((o) =>
        o
          .setName("retention_days")
          .setDescription("Rolling profile retention in days")
          .setMinValue(1)
          .setMaxValue(365),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("image-add")
      .setDescription("Add a banned image fingerprint")
      .addAttachmentOption((o) =>
        o.setName("image").setDescription("Image attachment to ban").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("reason")
          .setDescription("Why this image should be removed")
          .setRequired(true)
          .setMaxLength(240),
      )
      .addStringOption((o) =>
        o.setName("label").setDescription("Short optional label").setMaxLength(80),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("image-list").setDescription("List active banned image fingerprints"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("image-remove")
      .setDescription("Remove a banned image fingerprint")
      .addStringOption((o) =>
        o.setName("id").setDescription("Banned image id from image-list").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("image-toggle")
      .setDescription("Enable or disable banned-image detection")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Enable or disable image detection")
          .setRequired(true)
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("image-channel")
      .setDescription("Set the banned-image report channel")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Report channel (omit to clear)"),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("panel").setDescription("Open the automod configuration panel"),
  );

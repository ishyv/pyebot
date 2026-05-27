import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
/**
 * /modset — configure the moderation feature.
 *
 * Subcommands:
 *   log-channel        set the mod log channel
 *   appeals-channel    set the ban appeals channel
 *   escalation add     add a warn threshold → auto-action
 *   escalation clear   remove all escalation thresholds
 *   quarantine role    set the quarantine role
 *   quarantine channel set the quarantine review channel
 *   verify mode        configure the verification gate mode
 *   verify channel     channel where verify prompt is posted
 *   verify role        role granted on verification pass
 *   verify min-age     minimum account age in days
 *   alt-detection      enable/disable alt account detection
 *   status             show all current config
 */

import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import { DURATION_MAP } from "@/features/moderation/service";
import { container, text, v2Message } from "@/ui/v2";

const data = command("modset")
  .setDescription("Configure moderation settings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  // ── Channels ──────────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName("log-channel")
      .setDescription("Set the channel where all mod actions are logged")
      .addChannelOption((o) => o.setName("channel").setDescription("Log channel (omit to clear)")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("appeals-channel")
      .setDescription("Set the channel where ban appeal threads are created")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Appeals channel (omit to clear)"),
      ),
  )
  // ── Escalation ────────────────────────────────────────────────────────────
  .addSubcommandGroup((group) =>
    group
      .setName("escalation")
      .setDescription("Configure automatic punishment escalation on warns")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add an escalation threshold")
          .addIntegerOption((o) =>
            o
              .setName("warns")
              .setDescription("Number of warns that triggers this action")
              .setMinValue(1)
              .setRequired(true),
          )
          .addStringOption((o) =>
            o
              .setName("action")
              .setDescription("Action to take")
              .setRequired(true)
              .addChoices(
                { name: "Timeout", value: "timeout" },
                { name: "Kick", value: "kick" },
                { name: "Ban", value: "ban" },
              ),
          )
          .addStringOption((o) =>
            o
              .setName("duration")
              .setDescription("Timeout duration (required when action is Timeout)")
              .addChoices(...Object.keys(DURATION_MAP).map((d) => ({ name: d, value: d }))),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("clear").setDescription("Remove all escalation thresholds"),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("Show current escalation thresholds"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable escalation")
          .addStringOption((o) =>
            o
              .setName("action")
              .setDescription("Enable or disable")
              .setRequired(true)
              .addChoices(
                { name: "Enable", value: "enable" },
                { name: "Disable", value: "disable" },
              ),
          ),
      ),
  )
  // ── Quarantine ────────────────────────────────────────────────────────────
  .addSubcommandGroup((group) =>
    group
      .setName("quarantine")
      .setDescription("Configure the quarantine role system")
      .addSubcommand((sub) =>
        sub
          .setName("role")
          .setDescription("Set the quarantine role")
          .addRoleOption((o) =>
            o.setName("role").setDescription("Quarantine role (omit to clear)"),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("channel")
          .setDescription("Set the review channel for quarantined users")
          .addChannelOption((o) =>
            o.setName("channel").setDescription("Review channel (omit to clear)"),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable the quarantine system")
          .addStringOption((o) =>
            o
              .setName("action")
              .setDescription("Enable or disable")
              .setRequired(true)
              .addChoices(
                { name: "Enable", value: "enable" },
                { name: "Disable", value: "disable" },
              ),
          ),
      ),
  )
  // ── Verification ──────────────────────────────────────────────────────────
  .addSubcommandGroup((group) =>
    group
      .setName("verify")
      .setDescription("Configure the member verification gate")
      .addSubcommand((sub) =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable the verification gate")
          .addStringOption((o) =>
            o
              .setName("action")
              .setDescription("Enable or disable")
              .setRequired(true)
              .addChoices(
                { name: "Enable", value: "enable" },
                { name: "Disable", value: "disable" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("mode")
          .setDescription("Set how new members verify")
          .addStringOption((o) =>
            o
              .setName("mode")
              .setDescription("Verification mode")
              .setRequired(true)
              .addChoices(
                { name: "Button (click to verify)", value: "button" },
                { name: "Account age gate (auto-kick if too new)", value: "account_age" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("channel")
          .setDescription("Channel where the verify prompt is posted")
          .addChannelOption((o) =>
            o.setName("channel").setDescription("Verify channel (omit to clear)"),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("role")
          .setDescription("Role granted when a member passes verification")
          .addRoleOption((o) => o.setName("role").setDescription("Verified role (omit to clear)")),
      )
      .addSubcommand((sub) =>
        sub
          .setName("min-age")
          .setDescription("Minimum account age in days (0 = no minimum)")
          .addIntegerOption((o) =>
            o
              .setName("days")
              .setDescription("Days")
              .setMinValue(0)
              .setMaxValue(365)
              .setRequired(true),
          ),
      ),
  )
  // ── Alt detection ─────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName("alt-detection")
      .setDescription("Enable or disable alt account detection alerts")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Enable or disable")
          .setRequired(true)
          .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" }),
      ),
  )
  // ── Status ────────────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Show full moderation configuration"),
  )
  .addSubcommand((sub) =>
    sub.setName("panel").setDescription("Open the moderation configuration panel"),
  );

// ---------------------------------------------------------------------------
// execute
// ---------------------------------------------------------------------------

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await ctx.respond.send({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await ctx.respond.defer({ visibility: "ephemeral" });

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (!group) {
    if (sub === "log-channel") return handleLogChannel(interaction, ctx, guildId);
    if (sub === "appeals-channel") return handleAppealsChannel(interaction, ctx, guildId);
    if (sub === "alt-detection") return handleAltDetection(interaction, ctx, guildId);
    if (sub === "status") return handleStatus(interaction, ctx, guildId);
    if (sub === "panel") {
      if (!(await assertPanelPermission(interaction))) return;
      return openAdminPanel(interaction, "moderation");
    }
  }

  if (group === "escalation") {
    if (sub === "add") return handleEscalationAdd(interaction, ctx, guildId);
    if (sub === "clear") return handleEscalationClear(interaction, ctx, guildId);
    if (sub === "list") return handleEscalationList(interaction, ctx, guildId);
    if (sub === "toggle") return handleEscalationToggle(interaction, ctx, guildId);
  }

  if (group === "quarantine") {
    if (sub === "role") return handleQuarantineRole(interaction, ctx, guildId);
    if (sub === "channel") return handleQuarantineChannel(interaction, ctx, guildId);
    if (sub === "toggle") return handleQuarantineToggle(interaction, ctx, guildId);
  }

  if (group === "verify") {
    if (sub === "toggle") return handleVerifyToggle(interaction, ctx, guildId);
    if (sub === "mode") return handleVerifyMode(interaction, ctx, guildId);
    if (sub === "channel") return handleVerifyChannel(interaction, ctx, guildId);
    if (sub === "role") return handleVerifyRole(interaction, ctx, guildId);
    if (sub === "min-age") return handleVerifyMinAge(interaction, ctx, guildId);
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleLogChannel(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const channel = i.options.getChannel("channel");
  await updateGuildPaths(guildId, { "moderation.modLogChannelId": channel?.id ?? null });
  await ctx.respond.send({
    content: channel ? `Mod log set to <#${channel.id}>.` : "Mod log channel cleared.",
  });
}

async function handleAppealsChannel(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const channel = i.options.getChannel("channel");
  await updateGuildPaths(guildId, { "moderation.appealsChannelId": channel?.id ?? null });
  await ctx.respond.send({
    content: channel ? `Appeals channel set to <#${channel.id}>.` : "Appeals channel cleared.",
  });
}

async function handleAltDetection(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const enabled = i.options.getString("action", true) === "enable";
  await updateGuildPaths(guildId, { "moderation.altDetectionEnabled": enabled });
  await ctx.respond.send({
    content: `Alt detection is now **${enabled ? "enabled" : "disabled"}**.`,
  });
}

async function handleEscalationAdd(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const warnCount = i.options.getInteger("warns", true);
  const action = i.options.getString("action", true) as "timeout" | "kick" | "ban";
  const durationKey = i.options.getString("duration") ?? undefined;

  if (action === "timeout" && !durationKey) {
    await ctx.respond.send({ content: "A duration is required when the action is Timeout." });
    return;
  }

  const guildResult = await getGuild(guildId);
  if (guildResult.isErr()) {
    await ctx.respond.send({ content: "Failed to load config." });
    return;
  }

  const existing = guildResult.unwrap()?.moderation.escalation.thresholds ?? [];
  if (existing.some((t) => t.warnCount === warnCount)) {
    await ctx.respond.send({
      content: `A threshold for **${warnCount} warns** already exists. Delete the old one first.`,
    });
    return;
  }

  const updated = [...existing, { warnCount, action, ...(durationKey ? { durationKey } : {}) }];
  await updateGuildPaths(guildId, { "moderation.escalation.thresholds": updated });

  const label =
    action === "timeout"
      ? `Timeout ${durationKey}`
      : action.charAt(0).toUpperCase() + action.slice(1);
  await ctx.respond.send({ content: `Threshold added: **${warnCount} warns → ${label}**.` });
}

async function handleEscalationClear(
  _i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  await updateGuildPaths(guildId, { "moderation.escalation.thresholds": [] });
  await ctx.respond.send({ content: "All escalation thresholds cleared." });
}

async function handleEscalationList(
  _i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const guildResult = await getGuild(guildId);
  if (guildResult.isErr()) {
    await ctx.respond.send({ content: "Failed to load config." });
    return;
  }

  const { enabled, thresholds } = guildResult.unwrap()?.moderation.escalation ?? {
    enabled: false,
    thresholds: [],
  };
  if (thresholds.length === 0) {
    await ctx.respond.send({
      content: `Escalation is **${enabled ? "enabled" : "disabled"}** — no thresholds configured.`,
    });
    return;
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
  await ctx.respond.send({
    content: `**Escalation** (${enabled ? "✅ on" : "❌ off"})\n${lines.join("\n")}`,
  });
}

async function handleEscalationToggle(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const enabled = i.options.getString("action", true) === "enable";
  await updateGuildPaths(guildId, { "moderation.escalation.enabled": enabled });
  await ctx.respond.send({ content: `Escalation is now **${enabled ? "enabled" : "disabled"}**.` });
}

async function handleQuarantineRole(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const role = i.options.getRole("role");
  await updateGuildPaths(guildId, { "moderation.quarantine.roleId": role?.id ?? null });
  await ctx.respond.send({
    content: role ? `Quarantine role set to <@&${role.id}>.` : "Quarantine role cleared.",
  });
}

async function handleQuarantineChannel(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const channel = i.options.getChannel("channel");
  await updateGuildPaths(guildId, { "moderation.quarantine.channelId": channel?.id ?? null });
  await ctx.respond.send({
    content: channel
      ? `Quarantine channel set to <#${channel.id}>.`
      : "Quarantine channel cleared.",
  });
}

async function handleQuarantineToggle(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const enabled = i.options.getString("action", true) === "enable";
  await updateGuildPaths(guildId, { "moderation.quarantine.enabled": enabled });
  await ctx.respond.send({ content: `Quarantine is now **${enabled ? "enabled" : "disabled"}**.` });
}

async function handleVerifyToggle(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const enabled = i.options.getString("action", true) === "enable";
  await updateGuildPaths(guildId, { "moderation.verification.enabled": enabled });
  await ctx.respond.send({
    content: `Verification gate is now **${enabled ? "enabled" : "disabled"}**.`,
  });
}

async function handleVerifyMode(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const mode = i.options.getString("mode", true);
  await updateGuildPaths(guildId, { "moderation.verification.mode": mode });
  await ctx.respond.send({ content: `Verification mode set to **${mode}**.` });
}

async function handleVerifyChannel(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const channel = i.options.getChannel("channel");
  await updateGuildPaths(guildId, { "moderation.verification.channelId": channel?.id ?? null });
  await ctx.respond.send({
    content: channel ? `Verify channel set to <#${channel.id}>.` : "Verify channel cleared.",
  });
}

async function handleVerifyRole(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const role = i.options.getRole("role");
  await updateGuildPaths(guildId, { "moderation.verification.roleId": role?.id ?? null });
  await ctx.respond.send({
    content: role ? `Verified role set to <@&${role.id}>.` : "Verified role cleared.",
  });
}

async function handleVerifyMinAge(
  i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const days = i.options.getInteger("days", true);
  await updateGuildPaths(guildId, { "moderation.verification.minAccountAgeDays": days });
  await ctx.respond.send({
    content: `Minimum account age set to **${days} day${days === 1 ? "" : "s"}**.`,
  });
}

async function handleStatus(
  _i: ChatInputCommandInteraction,
  ctx: Ctx,
  guildId: string,
): Promise<void> {
  const guildResult = await getGuild(guildId);
  if (guildResult.isErr() || !guildResult.unwrap()) {
    await ctx.respond.send({ content: "Failed to load config." });
    return;
  }
  const cfg = guildResult.unwrap()!.moderation;
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

  await ctx.respond.send(
    v2Message(container("info", text(`## Moderation Config\n${lines.join("\n")}`))),
  );
}

export default data
  .help({ hints: ["/modconfig modlog", "/mod help"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

import {
  ActionRowBuilder,
  type APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { invalidatePatternCache } from "@/features/automod/service";
import { applyGuildConfigPaths } from "../configMutations";
import { channelMention, limitText, loadGuildConfig, modalInput } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

const AUTOMOD_SECTIONS = [
  "linkSpam",
  "mentionSpam",
  "crossChannelSpam",
  "slowmode",
  "perUserSlow",
  "raidDetection",
  "domainWhitelist",
  "shorteners",
] as const;
type AutomodSection = (typeof AUTOMOD_SECTIONS)[number];

function selectedSection(session: PanelState): AutomodSection {
  return AUTOMOD_SECTIONS.includes(session.selectedAutomodSection as AutomodSection)
    ? (session.selectedAutomodSection as AutomodSection)
    : "linkSpam";
}

function sectionLabel(section: AutomodSection): string {
  const labels: Record<AutomodSection, string> = {
    linkSpam: "Link spam",
    mentionSpam: "Mention spam",
    crossChannelSpam: "Cross-channel spam",
    slowmode: "Auto slowmode",
    perUserSlow: "User slow roles",
    raidDetection: "Raid detection",
    domainWhitelist: "Domain whitelist",
    shorteners: "Short links",
  };
  return labels[section];
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    timeout: "Timeout",
    mute: "Mute",
    delete: "Delete",
    report: "Report only",
    alert: "Alert",
    lockdown: "Lockdown",
    quarantine: "Quarantine",
  };
  return labels[action] ?? action;
}

function policyField(cfg: GuildConfig): APIEmbedField {
  const policy = cfg.automod.policy;
  return {
    name: "Tiered policy",
    value: [
      `Preset: **${policy.preset}**`,
      `Profiles: **${policy.profileRetentionDays}d rolling**`,
      `AI detector: **${policy.aiDetector.enabled ? "On" : "Off"}**`,
      `Staff bypass: **${policy.bypass.staffBypass ? "On" : "Off"}**`,
      `Overrides: **${policy.bypass.ignoredChannelIds.length} ignored channels**, **${policy.bypass.strictChannelIds.length} strict channels**, **${policy.bypass.trustedRoleIds.length} trusted roles**, **${policy.bypass.protectedRoleIds.length} protected roles**`,
      `Rate limits: **${policy.alertRateLimit.maxAlerts} alerts/${policy.alertRateLimit.windowSeconds}s**, **${policy.actionRateLimit.maxActions} actions/${policy.actionRateLimit.windowSeconds}s**`,
    ].join("\n"),
    inline: false,
  };
}

function selectedField(section: AutomodSection, cfg: GuildConfig): APIEmbedField {
  const automod = cfg.automod;
  const state = (enabled: boolean) => (enabled ? "Active" : "Off");
  switch (section) {
    case "linkSpam":
      return {
        name: "Selected - Link spam",
        value: [
          `Status: **${state(automod.linkSpam.enabled)}**`,
          `Trigger: **${automod.linkSpam.maxLinks} links / ${automod.linkSpam.windowSeconds}s**`,
          `Response: **${actionLabel(automod.linkSpam.action)}**`,
          `Reports: ${channelMention(automod.linkSpam.reportChannelId)}`,
        ].join("\n"),
        inline: false,
      };
    case "mentionSpam":
      return {
        name: "Selected - Mention spam",
        value: [
          `Status: **${state(automod.mentionSpam.enabled)}**`,
          `Trigger: **${automod.mentionSpam.maxMentions} mentions / ${automod.mentionSpam.windowSeconds}s**`,
          `Response: **${actionLabel(automod.mentionSpam.action)}**`,
          `Timeout: **${automod.mentionSpam.timeoutSeconds}s**`,
          `Reports: ${channelMention(automod.mentionSpam.reportChannelId)}`,
        ].join("\n"),
        inline: false,
      };
    case "crossChannelSpam":
      return {
        name: "Selected - Cross-channel spam",
        value: [
          `Status: **${state(automod.crossChannelSpam.enabled)}**`,
          `Trigger: **${automod.crossChannelSpam.minChannels} channels / ${automod.crossChannelSpam.windowSeconds}s**`,
          `Auto-timeout: **${automod.crossChannelSpam.autoTimeout ? `${automod.crossChannelSpam.timeoutSeconds}s` : "Off"}**`,
          `Reports: ${channelMention(automod.crossChannelSpam.reportChannelId)}`,
        ].join("\n"),
        inline: false,
      };
    case "slowmode":
      return {
        name: "Selected - Auto slowmode",
        value: [
          `Status: **${state(automod.slowmode.enabled)}**`,
          `Trigger: **${automod.slowmode.messagesPerWindow} messages / ${automod.slowmode.windowSeconds}s**`,
          `Applied rate: **${automod.slowmode.slowmodeSeconds}s**`,
          `Release after: **${automod.slowmode.releaseAfterSeconds}s**`,
        ].join("\n"),
        inline: false,
      };
    case "perUserSlow":
      return {
        name: "Selected - User slow roles",
        value: [
          `Status: **${state(automod.perUserSlow.enabled)}**`,
          `Rules: **${automod.perUserSlow.rules.length} configured**`,
          automod.perUserSlow.rules.length
            ? limitText(
                automod.perUserSlow.rules
                  .map(
                    (rule) =>
                      `${rule.enabled ? "On" : "Off"} - <@&${rule.roleId}> - ${rule.cooldownSeconds}s cooldown - ${rule.durationSeconds}s effect`,
                  )
                  .join("\n"),
                900,
              )
            : "No slow roles configured.",
        ].join("\n"),
        inline: false,
      };
    case "raidDetection":
      return {
        name: "Selected - Raid detection",
        value: [
          `Status: **${state(automod.raidDetection.enabled)}**`,
          `Trigger: **${automod.raidDetection.joinsPerMinute} joins/min**`,
          `New-account window: **${automod.raidDetection.minAccountAgeDays}d**`,
          `Response: **${actionLabel(automod.raidDetection.action)}**`,
          `Reports: ${channelMention(automod.raidDetection.reportChannelId)}`,
        ].join("\n"),
        inline: false,
      };
    case "domainWhitelist":
      return {
        name: "Selected - Domain whitelist",
        value: [
          `Status: **${state(automod.domainWhitelist.enabled)}**`,
          `Allowed domains: **${automod.domainWhitelist.domains.length}**`,
          limitText(
            automod.domainWhitelist.domains.length
              ? automod.domainWhitelist.domains.map((domain) => `\`${domain}\``).join(", ")
              : "No domains configured.",
            500,
          ),
        ].join("\n"),
        inline: false,
      };
    case "shorteners":
      return {
        name: "Selected - Short links",
        value: [
          `Status: **${state(automod.shorteners.enabled)}**`,
          `Resolve final URL: **${automod.shorteners.resolveFinalUrl ? "Yes" : "No"}**`,
          `Known shorteners: **${automod.shorteners.allowedShorteners.length}**`,
          limitText(
            automod.shorteners.allowedShorteners.map((domain) => `\`${domain}\``).join(", "),
            500,
          ),
        ].join("\n"),
        inline: false,
      };
  }
}

function coverageField(cfg: GuildConfig): APIEmbedField {
  const automod = cfg.automod;
  const rows: Array<[AutomodSection, boolean, string]> = [
    [
      "linkSpam",
      automod.linkSpam.enabled,
      `${automod.linkSpam.maxLinks}/${automod.linkSpam.windowSeconds}s`,
    ],
    [
      "mentionSpam",
      automod.mentionSpam.enabled,
      `${automod.mentionSpam.maxMentions}/${automod.mentionSpam.windowSeconds}s`,
    ],
    [
      "crossChannelSpam",
      automod.crossChannelSpam.enabled,
      `${automod.crossChannelSpam.minChannels}ch/${automod.crossChannelSpam.windowSeconds}s`,
    ],
    [
      "slowmode",
      automod.slowmode.enabled,
      `${automod.slowmode.messagesPerWindow}/${automod.slowmode.windowSeconds}s`,
    ],
    ["perUserSlow", automod.perUserSlow.enabled, `${automod.perUserSlow.rules.length} roles`],
    ["raidDetection", automod.raidDetection.enabled, `${automod.raidDetection.joinsPerMinute}/min`],
    [
      "domainWhitelist",
      automod.domainWhitelist.enabled,
      `${automod.domainWhitelist.domains.length} domains`,
    ],
    [
      "shorteners",
      automod.shorteners.enabled,
      `${automod.shorteners.allowedShorteners.length} known`,
    ],
  ];
  return {
    name: "Coverage",
    value: rows
      .map(
        ([section, enabled, detail]) =>
          `${enabled ? "On " : "Off"} - **${sectionLabel(section)}** (${detail})`,
      )
      .join("\n"),
    inline: false,
  };
}

function textRulesField(cfg: GuildConfig): APIEmbedField {
  const rules = cfg.automod.textRules;
  return {
    name: "Text rules",
    value: rules.length
      ? limitText(
          rules
            .slice(0, 5)
            .map(
              (rule) =>
                `**${rule.id}** - ${rule.enabled ? "On" : "Off"} - ${actionLabel(rule.action)} - \`${rule.phrases.join("`, `")}\``,
            )
            .join("\n"),
          900,
        )
      : "No plain text rules configured.",
    inline: false,
  };
}

function patternsField(cfg: GuildConfig): APIEmbedField {
  const patterns = cfg.automod.customPatterns;
  return {
    name: "Advanced regex patterns",
    value: patterns.length
      ? limitText(
          patterns
            .slice(0, 5)
            .map((p) => `**${p.name}** - ${actionLabel(p.action)} - \`/${p.pattern}/${p.flags}\``)
            .join("\n"),
          900,
        )
      : "No custom regex patterns configured.",
    inline: false,
  };
}

/**
 * Renders the automod panel.
 * Exported for the automodPanel.test.ts fixture which tests rendered output directly.
 */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  const section = selectedSection(session);
  const automod = cfg.automod;
  const sectionSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "automod", "section"))
    .setPlaceholder("Choose automod section")
    .addOptions(
      AUTOMOD_SECTIONS.map((name) => {
        const item = automod[name] as { enabled?: boolean } | undefined;
        return new StringSelectMenuOptionBuilder()
          .setLabel(sectionLabel(name))
          .setDescription(item?.enabled ? "Enabled" : "Disabled")
          .setValue(name)
          .setDefault(section === name);
      }),
    );
  return {
    container: panelContainer({
      title: "Automod Panel",
      description: [
        `Editing **${sectionLabel(section)}**.`,
        "Use the menu to switch protections, then configure the selected section below.",
      ].join("\n"),
      fields: [
        policyField(cfg),
        selectedField(section, cfg),
        coverageField(cfg),
        textRulesField(cfg),
        patternsField(cfg),
      ],
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "report-channel"))
          .setPlaceholder("Set report channel for selected section")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "slow-role"))
          .setPlaceholder("Select user slow role")
          .setDisabled(section !== "perUserSlow")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "toggle"))
          .setLabel("Toggle selected")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "config-modal"))
          .setLabel("Configure selected")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "pattern-modal"))
          .setLabel("Add regex pattern")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "clear-patterns"))
          .setLabel("Clear patterns")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "remove-slow-rule"))
          .setLabel("Remove slow role")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(section !== "perUserSlow"),
      ),
    ],
  };
}

async function showConfigModal(
  interaction: ComponentInteraction,
  session: PanelState,
  section: string,
): Promise<void> {
  if (!interaction.isButton()) throw new Error("This action must be opened from a button.");
  const modal = new ModalBuilder()
    .setCustomId(makePanelCustomId(session, "automod", "config-submit"))
    .setTitle(`Configure ${section}`);
  if (section === "domainWhitelist") {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("domains")
          .setLabel("Domains, comma-separated")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
    );
  } else if (section === "perUserSlow") {
    const roleId = session.selectedRoleIds[0];
    if (!roleId) throw new Error("Select a slow role first.");
    modal.addComponents(
      modalInput("a", "Cooldown seconds", "30", true),
      modalInput("b", "Effect duration seconds", "3600", true),
      modalInput("c", "Rule enabled: true or false", "true", false),
    );
  } else {
    modal.addComponents(
      modalInput("a", "Primary number", "4", false),
      modalInput("b", "Window seconds", "10", false),
      modalInput("c", "Action or duration", "timeout", false),
    );
  }
  await interaction.showModal(modal);
}

async function saveConfig(
  interaction: ComponentInteraction,
  session: PanelState,
  section: string,
  cfg: GuildConfig,
): Promise<void> {
  if (!interaction.isModalSubmit()) return;
  if (section === "domainWhitelist") {
    const domains = interaction.fields
      .getTextInputValue("domains")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    await applyGuildConfigPaths(
      session.guildId,
      { "automod.domainWhitelist.domains": domains, "automod.domainWhitelist.enabled": true },
      { upsert: true },
    );
    return;
  }
  const a = interaction.fields.getTextInputValue("a").trim();
  const b = interaction.fields.getTextInputValue("b").trim();
  const c = interaction.fields.getTextInputValue("c").trim();
  const patch: Record<string, unknown> = {};
  const numA = a ? Number(a) : null;
  const numB = b ? Number(b) : null;
  if (numA !== null && !Number.isFinite(numA)) throw new Error("Primary number must be numeric.");
  if (numB !== null && !Number.isFinite(numB)) throw new Error("Window seconds must be numeric.");
  if (section === "linkSpam") {
    if (numA !== null) patch["automod.linkSpam.maxLinks"] = Math.trunc(numA);
    if (numB !== null) patch["automod.linkSpam.windowSeconds"] = Math.trunc(numB);
    if (c) patch["automod.linkSpam.action"] = c;
  } else if (section === "mentionSpam") {
    if (numA !== null) patch["automod.mentionSpam.maxMentions"] = Math.trunc(numA);
    if (numB !== null) patch["automod.mentionSpam.windowSeconds"] = Math.trunc(numB);
    if (c) patch["automod.mentionSpam.action"] = c;
  } else if (section === "crossChannelSpam") {
    if (numA !== null) patch["automod.crossChannelSpam.minChannels"] = Math.trunc(numA);
    if (numB !== null) patch["automod.crossChannelSpam.windowSeconds"] = Math.trunc(numB);
    if (c) patch["automod.crossChannelSpam.timeoutSeconds"] = Math.trunc(Number(c));
  } else if (section === "slowmode") {
    if (numA !== null) patch["automod.slowmode.messagesPerWindow"] = Math.trunc(numA);
    if (numB !== null) patch["automod.slowmode.windowSeconds"] = Math.trunc(numB);
    if (c) patch["automod.slowmode.slowmodeSeconds"] = Math.trunc(Number(c));
  } else if (section === "perUserSlow") {
    const roleId = session.selectedRoleIds[0];
    if (!roleId) throw new Error("Select a slow role first.");
    const existing = cfg.automod.perUserSlow.rules.find((rule) => rule.roleId === roleId);
    const enabled = c ? c === "true" || c === "yes" || c === "1" || c === "on" : true;
    const nextRule = {
      enabled,
      roleId,
      cooldownSeconds: Math.trunc(numA ?? existing?.cooldownSeconds ?? 30),
      durationSeconds: Math.trunc(numB ?? existing?.durationSeconds ?? 3600),
    };
    if (nextRule.cooldownSeconds < 1) throw new Error("Cooldown seconds must be at least 1.");
    if (nextRule.durationSeconds < 60) throw new Error("Effect duration must be at least 60s.");
    patch["automod.perUserSlow.enabled"] = true;
    patch["automod.perUserSlow.rules"] = [
      ...cfg.automod.perUserSlow.rules.filter((rule) => rule.roleId !== roleId),
      nextRule,
    ];
  } else if (section === "raidDetection") {
    if (numA !== null) patch["automod.raidDetection.joinsPerMinute"] = Math.trunc(numA);
    if (numB !== null) patch["automod.raidDetection.minAccountAgeDays"] = Math.trunc(numB);
    if (c) patch["automod.raidDetection.action"] = c;
  } else if (section === "shorteners") {
    patch["automod.shorteners.resolveFinalUrl"] = c === "true" || c === "yes" || c === "1";
  }
  if (Object.keys(patch).length)
    await applyGuildConfigPaths(session.guildId, patch, { upsert: true });
}

/** Handles section selection, toggles, report channel, and config/pattern modals. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  const section = session.selectedAutomodSection ?? "linkSpam";
  const automod = cfg.automod as unknown as Record<string, { enabled?: boolean }>;
  if (interaction.isStringSelectMenu() && actionStr === "section") {
    session.selectedAutomodSection = interaction.values[0];
    return true;
  }
  if (interaction.isRoleSelectMenu() && actionStr === "slow-role") {
    if (section !== "perUserSlow") throw new Error("Switch to User slow roles first.");
    session.selectedRoleIds = interaction.values;
    return true;
  }
  if (actionStr === "toggle") {
    await applyGuildConfigPaths(
      session.guildId,
      { [`automod.${section}.enabled`]: !automod[section]?.enabled },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isChannelSelectMenu() && actionStr === "report-channel") {
    if (!["linkSpam", "mentionSpam", "crossChannelSpam", "raidDetection"].includes(section))
      throw new Error("Selected automod section has no report channel.");
    await applyGuildConfigPaths(
      session.guildId,
      { [`automod.${section}.reportChannelId`]: interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (actionStr === "config-modal" && interaction.isButton()) {
    await showConfigModal(interaction, session, section);
    return false;
  }
  if (actionStr === "config-submit" && interaction.isModalSubmit()) {
    await saveConfig(interaction, session, section, cfg);
    return true;
  }
  if (actionStr === "remove-slow-rule") {
    if (section !== "perUserSlow") throw new Error("Switch to User slow roles first.");
    const roleId = session.selectedRoleIds[0];
    if (!roleId) throw new Error("Select a slow role first.");
    await applyGuildConfigPaths(
      session.guildId,
      {
        "automod.perUserSlow.rules": cfg.automod.perUserSlow.rules.filter(
          (rule) => rule.roleId !== roleId,
        ),
      },
      { upsert: true },
    );
    session.selectedRoleIds = [];
    return true;
  }
  if (actionStr === "pattern-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "automod", "pattern-submit"))
      .setTitle("Add automod pattern")
      .addComponents(
        modalInput("name", "Pattern name", "invite-filter", true),
        modalInput("regex", "Regex", "discord\\.gg", true),
        modalInput("flags", "Regex flags", "i", false),
        modalInput("response", "Action: delete, timeout, report", "delete", false),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "pattern-submit" && interaction.isModalSubmit()) {
    const name = interaction.fields.getTextInputValue("name").trim();
    const pattern = interaction.fields.getTextInputValue("regex");
    const flags = interaction.fields.getTextInputValue("flags").trim() || "i";
    const response = interaction.fields.getTextInputValue("response").trim() || "delete";
    new RegExp(pattern, flags);
    await applyGuildConfigPaths(
      session.guildId,
      {
        "automod.customPatterns": [
          ...cfg.automod.customPatterns,
          {
            name,
            pattern,
            flags,
            action: response as "delete" | "timeout" | "report",
            timeoutSeconds: 300,
          },
        ],
      },
      { upsert: true },
    );
    invalidatePatternCache(session.guildId);
    return true;
  }
  if (actionStr === "clear-patterns") {
    await applyGuildConfigPaths(
      session.guildId,
      { "automod.customPatterns": [] },
      { upsert: true },
    );
    invalidatePatternCache(session.guildId);
  }
  return true;
}

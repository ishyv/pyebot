import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type {
  Guild as GuildConfig,
  TempRoleAccessRule,
  TempRoleMessageRule,
} from "@/db/schemas/guild";
import {
  accessOverwritePreview,
  formatTempRoleAccessRule,
  formatTempRoleMessageRule,
  formatTempRolePolicyReview,
  parseDurationSeconds,
} from "../newUsersPolicy";
import {
  channelMention,
  limitText,
  loadGuildConfig,
  modalInput,
  roleMention,
  yesNo,
} from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelActionRow,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

const NEW_USERS_SECTIONS = ["setup", "messageRules", "accessRules", "review"] as const;
type NewUsersSection = (typeof NEW_USERS_SECTIONS)[number];

const TEMP_ROLE_RULE_KINDS = [
  "links",
  "media",
  "mentions",
  "invites",
  "repeatedText",
  "caps",
  "crossChannel",
  "shortLinks",
  "regex",
] as const;
type TempRoleRuleKind = (typeof TEMP_ROLE_RULE_KINDS)[number];

function selectedSection(session: PanelState): NewUsersSection {
  return NEW_USERS_SECTIONS.includes(session.selectedNewUsersSection as NewUsersSection)
    ? (session.selectedNewUsersSection as NewUsersSection)
    : "setup";
}

function ruleKindLabel(kind: TempRoleRuleKind): string {
  const labels: Record<TempRoleRuleKind, string> = {
    links: "Links",
    media: "Media",
    mentions: "Mentions",
    invites: "Invites",
    repeatedText: "Repeated text",
    caps: "Caps",
    crossChannel: "Cross-channel spam",
    shortLinks: "Short links",
    regex: "Regex",
  };
  return labels[kind];
}

function setupSummary(
  policy: GuildConfig["automod"]["tempRolePolicies"]["recentlyJoined"],
): string {
  return [
    `Status: **${yesNo(policy.enabled)}**`,
    `Role: ${roleMention(policy.roleId)}`,
    `Duration: **${policy.durationSeconds}s**`,
    `Assign to accounts up to **${policy.maxAccountAgeDays}d** old`,
    `Skip roles: **${policy.skipRoleIds.length}**`,
    `Reports: ${channelMention(policy.reportChannelId)}`,
  ].join("\n");
}

function sectionRows(session: PanelState, section: NewUsersSection): PanelActionRow[] {
  if (section === "setup") {
    return [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "role"))
          .setPlaceholder("Set Recently Joined role")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "skip-roles"))
          .setPlaceholder("Set trusted/verified skip roles")
          .setMinValues(0)
          .setMaxValues(10),
      ),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "report-channel"))
          .setPlaceholder("Set report channel")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "toggle"))
          .setLabel("Toggle")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "setup-modal"))
          .setLabel("Set timing")
          .setStyle(ButtonStyle.Primary),
      ),
    ];
  }
  if (section === "messageRules") {
    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "rule-kind"))
          .setPlaceholder("What should this rule watch?")
          .addOptions(
            TEMP_ROLE_RULE_KINDS.map((kind) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(ruleKindLabel(kind))
                .setValue(kind)
                .setDefault((session.selectedNewUsersRuleKind ?? "links") === kind),
            ),
          ),
      ),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "scope"))
          .setPlaceholder("Where should the rule apply? Empty means server-wide")
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum,
            ChannelType.GuildMedia,
            ChannelType.GuildCategory,
          )
          .setMinValues(0)
          .setMaxValues(10),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "message-rule-modal"))
          .setLabel("Add rule")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "clear-message-rules"))
          .setLabel("Clear rules")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }
  if (section === "accessRules") {
    return [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "access-targets"))
          .setPlaceholder("Choose channels/categories to block")
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum,
            ChannelType.GuildMedia,
            ChannelType.GuildCategory,
          )
          .setMinValues(1)
          .setMaxValues(10),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "access-mode"))
          .setPlaceholder("Choose block type")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("Block sending")
              .setValue("send")
              .setDefault(session.selectedNewUsersAccessMode === "send"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Block viewing")
              .setValue("view")
              .setDefault(session.selectedNewUsersAccessMode === "view"),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "add-access-rule"))
          .setLabel("Add block")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "apply-access"))
          .setLabel("Apply overwrites")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "new-users", "clear-access-rules"))
          .setLabel("Clear blocks")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makePanelCustomId(session, "new-users", "apply-access"))
        .setLabel("Apply access preview")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

/** Renders the multi-section new users / recently-joined policy panel. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  const section = selectedSection(session);
  const policy = cfg.automod.tempRolePolicies.recentlyJoined;
  const sectionSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "new-users", "section"))
    .setPlaceholder("Choose setup step")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Setup")
        .setDescription("Role, duration, assignment, reports")
        .setValue("setup")
        .setDefault(section === "setup"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Message rules")
        .setDescription("Links, media, mentions, invites, regex")
        .setValue("messageRules")
        .setDefault(section === "messageRules"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Access blocklist")
        .setDescription("Block view/send in channels or categories")
        .setValue("accessRules")
        .setDefault(section === "accessRules"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Review")
        .setDescription("Plain-language policy summary")
        .setValue("review")
        .setDefault(section === "review"),
    );
  return {
    container: panelContainer({
      title: "New Users Panel",
      description: `Editing **${section}** for the Recently Joined policy.`,
      fields: [
        { name: "Setup", value: setupSummary(policy), inline: false },
        {
          name: "Message rules",
          value: policy.messageRules.length
            ? limitText(
                policy.messageRules.slice(0, 6).map(formatTempRoleMessageRule).join("\n"),
                1000,
              )
            : "No message rules configured.",
        },
        {
          name: "Access blocklist",
          value: policy.accessRules.length
            ? limitText(
                policy.accessRules.slice(0, 6).map(formatTempRoleAccessRule).join("\n"),
                1000,
              )
            : "No access blocklist rules configured.",
        },
        {
          name: "Review",
          value: limitText(
            `${formatTempRolePolicyReview(policy)}\n${accessOverwritePreview(policy)}`,
            1000,
          ),
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionSelect),
      ...sectionRows(session, section),
    ],
  };
}

async function splitChannels(
  interaction: ComponentInteraction,
  ids: readonly string[],
): Promise<{ channelIds: string[]; categoryIds: string[] }> {
  const channelIds: string[] = [];
  const categoryIds: string[] = [];
  for (const id of ids) {
    const channel =
      interaction.guild?.channels.cache.get(id) ??
      (interaction.guild ? await interaction.guild.channels.fetch(id).catch(() => null) : null);
    if (channel?.type === ChannelType.GuildCategory) categoryIds.push(id);
    else channelIds.push(id);
  }
  return { channelIds, categoryIds };
}

async function applyAccessOverwrites(
  interaction: ComponentInteraction,
  policy: GuildConfig["automod"]["tempRolePolicies"]["recentlyJoined"],
): Promise<void> {
  if (!interaction.guild) throw new Error("This action needs a server.");
  if (!policy.roleId) throw new Error("Set the Recently Joined role before applying access rules.");
  const { PermissionFlagsBits } = await import("discord.js");
  const me =
    interaction.guild.members.me ?? (await interaction.guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels))
    throw new Error("I need Manage Channels to apply access blocklist rules.");
  const role = await interaction.guild.roles.fetch(policy.roleId).catch(() => null);
  if (!role) throw new Error("The configured Recently Joined role no longer exists.");
  for (const rule of policy.accessRules.filter((r) => r.enabled)) {
    const channel = await interaction.guild.channels.fetch(rule.targetId).catch(() => null);
    if (!channel || !("permissionOverwrites" in channel)) continue;
    await channel.permissionOverwrites.edit(
      role,
      rule.mode === "view" ? { ViewChannel: false } : { SendMessages: false },
      { reason: "New Users access blocklist" },
    );
  }
}

/** Handles all new-users panel actions across setup, messageRules, accessRules, and review sections. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  const policy = cfg.automod.tempRolePolicies.recentlyJoined;
  const base = "automod.tempRolePolicies.recentlyJoined";
  if (interaction.isStringSelectMenu() && actionStr === "section") {
    session.selectedNewUsersSection = interaction.values[0];
    return true;
  }
  if (interaction.isRoleSelectMenu() && actionStr === "role") {
    await updateGuildPaths(
      session.guildId,
      { [`${base}.roleId`]: interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isRoleSelectMenu() && actionStr === "skip-roles") {
    await updateGuildPaths(
      session.guildId,
      { [`${base}.skipRoleIds`]: [...interaction.values] },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isChannelSelectMenu() && actionStr === "report-channel") {
    await updateGuildPaths(
      session.guildId,
      { [`${base}.reportChannelId`]: interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (actionStr === "toggle") {
    await updateGuildPaths(
      session.guildId,
      { [`${base}.enabled`]: !policy.enabled },
      { upsert: true },
    );
    return true;
  }
  if (actionStr === "setup-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "new-users", "setup-submit"))
      .setTitle("Recently Joined timing")
      .addComponents(
        modalInput("duration", "Role duration: 10m, 2h, 7d", "7d", true),
        modalInput(
          "age",
          "Max Discord account age in days",
          String(policy.maxAccountAgeDays),
          true,
        ),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "setup-submit" && interaction.isModalSubmit()) {
    const duration = parseDurationSeconds(interaction.fields.getTextInputValue("duration"));
    if (!duration.ok) throw new Error(duration.error);
    const maxAge = Number(interaction.fields.getTextInputValue("age"));
    if (!Number.isInteger(maxAge) || maxAge < 0 || maxAge > 365)
      throw new Error("Max account age must be a whole number from 0 to 365.");
    await updateGuildPaths(
      session.guildId,
      { [`${base}.durationSeconds`]: duration.seconds, [`${base}.maxAccountAgeDays`]: maxAge },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isStringSelectMenu() && actionStr === "rule-kind") {
    session.selectedNewUsersRuleKind = interaction.values[0];
    return true;
  }
  if (
    interaction.isChannelSelectMenu() &&
    (actionStr === "scope" || actionStr === "access-targets")
  ) {
    session.selectedNewUsersScopeIds = [...interaction.values];
    return true;
  }
  if (interaction.isStringSelectMenu() && actionStr === "access-mode") {
    const mode = interaction.values[0];
    if (mode === "view" || mode === "send") session.selectedNewUsersAccessMode = mode;
    return true;
  }
  if (actionStr === "message-rule-modal" && interaction.isButton()) {
    const kind = (session.selectedNewUsersRuleKind ?? "links") as TempRoleRuleKind;
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "new-users", "message-rule-submit"))
      .setTitle(`Add ${ruleKindLabel(kind)} rule`)
      .addComponents(
        modalInput("limit", "Limit/count", kind === "crossChannel" ? "3" : "1", true),
        modalInput("window", "Window seconds (blank for per-message)", "600", false),
        modalInput("action", "Action: report, delete, timeout", "delete", true),
        modalInput("timeout", "Timeout seconds", "300", false),
        modalInput("pattern", "Regex pattern (regex rules only)", "", false),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "message-rule-submit" && interaction.isModalSubmit()) {
    const kind = (session.selectedNewUsersRuleKind ?? "links") as TempRoleRuleKind;
    const ruleAction = interaction.fields.getTextInputValue("action").trim().toLowerCase();
    if (!["report", "delete", "timeout"].includes(ruleAction))
      throw new Error("Action must be report, delete, or timeout.");
    const limit = Number(interaction.fields.getTextInputValue("limit"));
    if (!Number.isInteger(limit) || limit < 1)
      throw new Error("Limit must be a positive whole number.");
    const rawWindow = interaction.fields.getTextInputValue("window").trim();
    const windowSeconds = rawWindow ? Number(rawWindow) : null;
    if (windowSeconds !== null && (!Number.isInteger(windowSeconds) || windowSeconds < 1))
      throw new Error("Window seconds must be blank or a positive whole number.");
    const timeoutSeconds = Number(interaction.fields.getTextInputValue("timeout") || "300");
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1)
      throw new Error("Timeout seconds must be a positive whole number.");
    const { channelIds, categoryIds } = await splitChannels(
      interaction,
      session.selectedNewUsersScopeIds,
    );
    const rule: TempRoleMessageRule = {
      id: `${kind}-${Date.now().toString(36)}`,
      enabled: true,
      kind,
      action: ruleAction as "report" | "delete" | "timeout",
      channelIds,
      categoryIds,
      limit,
      windowSeconds,
      timeoutSeconds,
      pattern: interaction.fields.getTextInputValue("pattern").trim() || null,
    };
    await updateGuildPaths(
      session.guildId,
      { [`${base}.messageRules`]: [...policy.messageRules, rule] },
      { upsert: true },
    );
    return true;
  }
  if (actionStr === "clear-message-rules") {
    await updateGuildPaths(session.guildId, { [`${base}.messageRules`]: [] }, { upsert: true });
    return true;
  }
  if (actionStr === "add-access-rule") {
    if (!session.selectedNewUsersScopeIds.length)
      throw new Error("Choose at least one channel or category first.");
    const { channelIds, categoryIds } = await splitChannels(
      interaction,
      session.selectedNewUsersScopeIds,
    );
    const rules: TempRoleAccessRule[] = [
      ...categoryIds.map((targetId) => ({
        id: `access-${targetId}-${Date.now().toString(36)}`,
        enabled: true,
        targetId,
        targetType: "category" as const,
        mode: session.selectedNewUsersAccessMode,
      })),
      ...channelIds.map((targetId) => ({
        id: `access-${targetId}-${Date.now().toString(36)}`,
        enabled: true,
        targetId,
        targetType: "channel" as const,
        mode: session.selectedNewUsersAccessMode,
      })),
    ];
    await updateGuildPaths(
      session.guildId,
      { [`${base}.accessRules`]: [...policy.accessRules, ...rules] },
      { upsert: true },
    );
    return true;
  }
  if (actionStr === "clear-access-rules") {
    await updateGuildPaths(session.guildId, { [`${base}.accessRules`]: [] }, { upsert: true });
    return true;
  }
  if (actionStr === "apply-access") {
    await applyAccessOverwrites(interaction, policy);
    return true;
  }
  return true;
}

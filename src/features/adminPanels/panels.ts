/**
 * Admin panel orchestration.
 *
 * This file currently owns the full dashboard loop: render the selected panel,
 * route component/modal actions, and write guild config patches. That makes it
 * the highest-risk admin surface, because UI state and persistence policy are
 * coupled in one place.
 *
 * Keep new admin behavior small here. The intended split is:
 * - declarative panel/field metadata,
 * - renderers grouped by domain,
 * - action handlers and modal parsers,
 * - patch builders for Mongo dot-path writes.
 */
import {
  ActionRowBuilder,
  type APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { getDb } from "@/core/db";
import type { ComponentInteraction, RuntimeFeature } from "@/core/feature";
import { listConfigurableFeatures } from "@/core/featureCatalog";
import {
  buildConfigFieldPatch,
  type FeatureConfigField,
  getConfigPathValue,
} from "@/core/featureConfig";
import { ensureGuild, getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import {
  DEFAULT_GUILD_FEATURES,
  Features,
  type Guild as GuildConfig,
  type GuildRoleRecord,
  type RoleCommandOverride,
  type RoleLimitRecord,
} from "@/db/schemas/guild";
import { aiConfig } from "@/features/ai/config";
import { invalidatePatternCache } from "@/features/automod/service";
import { listRules, setEnabled } from "@/features/autoroles/service";
import { Colors } from "@/utils/embeds";
import {
  makePanelCustomId,
  openPanelFromCommand,
  type PanelActionRow,
  type PanelId,
  type PanelPayload,
  type PanelState,
  panelEmbed,
  panelSessions,
  parsePanelCustomId,
  replyPanelError,
  respondToPanelCommand,
  updatePanelMessage,
  withNavigationRows,
} from "./panelRuntime";
import {
  createRoleRecord,
  formatLimit,
  formatOverride,
  MODERATION_ACTIONS,
  parseLimitWindow,
} from "./rolePolicy";

const CORE_CHANNEL_DEFINITIONS: Record<string, string> = {
  welcome: "Welcome messages",
  goodbye: "Goodbye messages",
  logs: "General logs",
  reports: "Report inbox",
  suggestions: "Suggestions",
  tickets: "Ticket prompt channel",
  messageLogs: "Moderation message logs",
  voiceLogs: "Voice activity logs",
  ticketLogs: "Ticket logs",
  ticketCategory: "Ticket category",
  pointsLog: "Points log",
  generalLogs: "Server events",
  banSanctions: "Sanction history",
  staff: "Staff alerts",
  repRequests: "Reputation requests",
  offersReview: "Offer review",
  approvedOffers: "Approved offers",
};

const AUTOMOD_SECTIONS = [
  "linkSpam",
  "mentionSpam",
  "crossChannelSpam",
  "slowmode",
  "raidDetection",
  "domainWhitelist",
  "shorteners",
] as const;
type AutomodSection = (typeof AUTOMOD_SECTIONS)[number];
const MODERATION_CHANNEL_FIELDS = [
  { value: "moderation.modLogChannelId", label: "Mod log channel" },
  { value: "moderation.appealsChannelId", label: "Appeals channel" },
  { value: "moderation.quarantine.channelId", label: "Quarantine channel" },
  { value: "moderation.verification.channelId", label: "Verification channel" },
] as const;
const TICKET_FIELDS = [
  { value: "channels.core.tickets", label: "Ticket prompt channel" },
  { value: "channels.core.ticketLogs", label: "Ticket log channel" },
  { value: "channels.ticketCategoryId", label: "Ticket category" },
] as const;
const OFFER_FIELDS = [
  { value: "channels.core.offersReview", label: "Review channel" },
  { value: "channels.core.approvedOffers", label: "Approved offers channel" },
] as const;

function yesNo(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}
function channelMention(channelId: string | null | undefined): string {
  return channelId ? `<#${channelId}>` : "Not set";
}
function roleMention(roleId: string | null | undefined): string {
  return roleId ? `<@&${roleId}>` : "Not set";
}
function limitText(value: unknown, max = 1000): string {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

async function loadGuildConfig(guildId: string): Promise<GuildConfig> {
  const existing = await getGuild(guildId);
  const existingGuild = existing.isOk() ? existing.unwrap() : null;
  if (existingGuild) return existingGuild;
  const ensured = await ensureGuild(guildId);
  if (ensured.isOk()) return ensured.unwrap();
  throw ensured.error;
}

function addNav(session: PanelState, payload: PanelPayload): PanelPayload {
  return withNavigationRows(session, payload);
}

function coreChannelValue(cfg: GuildConfig, key: string): string | null {
  return cfg.channels.core[key]?.channelId ?? null;
}

export async function openAdminPanel(
  interaction: ChatInputCommandInteraction,
  panelId: PanelId,
): Promise<void> {
  await openPanelFromCommand(interaction, panelId, renderPanel);
}

export async function assertPanelPermission(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const member = interaction.member;
  const allowed =
    member && typeof member.permissions !== "string" && member.permissions.has("ManageGuild");
  if (!allowed) {
    await respondToPanelCommand(interaction, {
      content: "You need Manage Server permission to use admin panels.",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

export async function handlePanelInteraction(interaction: ComponentInteraction): Promise<void> {
  const parsed = parsePanelCustomId(interaction.customId);
  if (!parsed) return;
  const session = panelSessions.get(parsed.sessionId);
  if (!session) {
    await replyPanelError(
      interaction,
      "This admin panel expired. Open it again with `/dashboard`.",
    );
    return;
  }
  if (session.ownerId !== interaction.user.id) {
    await replyPanelError(interaction, "This panel belongs to another moderator.");
    return;
  }
  if (interaction.guildId && interaction.guildId !== session.guildId) {
    await replyPanelError(interaction, "This panel belongs to another server.");
    return;
  }
  if (parsed.action === "close") {
    panelSessions.delete(session.id);
    await updatePanelMessage(interaction, {
      embeds: [panelEmbed({ title: "Panel closed", color: Colors.neutral as number })],
      components: [],
    });
    return;
  }
  try {
    const shouldRender = await applyPanelAction(
      interaction,
      session,
      parsed.panelId,
      parsed.action,
    );
    if (!shouldRender) return;
    await updatePanelMessage(interaction, await renderPanel(session));
  } catch (error) {
    await replyPanelError(interaction, error instanceof Error ? error.message : String(error));
  }
}

export async function renderPanel(session: PanelState): Promise<PanelPayload> {
  const cfg = await loadGuildConfig(session.guildId);
  const payload = await renderPanelBody(session, cfg);
  return addNav(session, payload);
}

async function renderPanelBody(session: PanelState, cfg: GuildConfig): Promise<PanelPayload> {
  switch (session.panelId) {
    case "channels":
      return renderChannelsPanel(session, cfg);
    case "features":
      return renderFeaturesPanel(session, cfg);
    case "feature-config":
      return renderFeatureConfigPanel(session, cfg);
    case "moderation":
      return renderModerationPanel(session, cfg);
    case "automod":
      return renderAutomodPanel(session, cfg);
    case "roles":
      return renderRolesPanel(session, cfg);
    case "autoroles":
      return renderAutorolesPanel(session);
    case "tickets":
      return renderTicketsPanel(session, cfg);
    case "ai":
      return renderAiPanel(session, cfg);
    case "offers":
      return renderOffersPanel(session, cfg);
    case "economy":
      return renderEconomyPanel(session, cfg);
    case "reputation":
      return renderReputationPanel(session, cfg);
    case "forums":
      return renderForumsPanel(session, cfg);
    case "tops":
      return renderTopsPanel(session, cfg);
    default:
      return renderHomePanel(session, cfg);
  }
}

function renderHomePanel(_session: PanelState, cfg: GuildConfig): PanelPayload {
  const enabled = Object.values({ ...DEFAULT_GUILD_FEATURES, ...cfg.features }).filter(
    Boolean,
  ).length;
  const fields: APIEmbedField[] = [
    {
      name: "Features",
      value: `${enabled}/${Object.values(Features).length} enabled`,
      inline: true,
    },
    {
      name: "Core channels",
      value: `${Object.values(cfg.channels.core).filter(Boolean).length}/${Object.keys(CORE_CHANNEL_DEFINITIONS).length} set`,
      inline: true,
    },
    { name: "Managed roles", value: String(Object.keys(cfg.roles).length), inline: true },
    {
      name: "Moderation",
      value: `Alt detection: ${yesNo(cfg.moderation.altDetectionEnabled)}\nEscalation: ${yesNo(cfg.moderation.escalation.enabled)}`,
      inline: true,
    },
    {
      name: "Automod",
      value: `Link spam: ${yesNo(cfg.automod.linkSpam.enabled)}\nRaid: ${yesNo(cfg.automod.raidDetection.enabled)}`,
      inline: true,
    },
    {
      name: "Economy",
      value: `Daily ${cfg.economy.daily.dailyReward} ${cfg.economy.daily.dailyCurrencyId}\nWork cap ${cfg.economy.work.workDailyCap}/day`,
      inline: true,
    },
  ];
  return {
    embeds: [
      panelEmbed({
        title: "Admin Dashboard",
        description: "Choose a panel below. All controls in this session are private to you.",
        fields,
        footer: "Ephemeral admin session expires after 5 minutes of inactivity.",
      }),
    ],
    components: [],
  };
}

function renderChannelsPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  const coreLines = Object.entries(CORE_CHANNEL_DEFINITIONS).map(
    ([key, label]) => `**${key}** - ${label}: ${channelMention(coreChannelValue(cfg, key))}`,
  );
  const managedEntries = Object.values(cfg.channels.managed);
  const managed = managedEntries.map(
    (entry) => `**${entry.id}** - ${entry.label}: <#${entry.channelId}>`,
  );
  const slotSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "slot"))
    .setPlaceholder("Choose a core channel slot")
    .addOptions(
      Object.entries(CORE_CHANNEL_DEFINITIONS)
        .slice(0, 25)
        .map(([key, label]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(key)
            .setDescription(label)
            .setValue(key)
            .setDefault(session.selectedChannelSlot === key),
        ),
    );
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "set-core"))
    .setPlaceholder("Set selected slot to this channel")
    .setMinValues(1)
    .setMaxValues(1);
  const managedChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "managed-channel"))
    .setPlaceholder("Pick channel for a new managed entry")
    .setMinValues(1)
    .setMaxValues(1);
  const addButton = new ButtonBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "managed-add-modal"))
    .setLabel("Add managed channel")
    .setStyle(ButtonStyle.Primary);
  const removeSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "channels", "managed-remove"))
    .setPlaceholder("Remove managed channel")
    .setDisabled(managedEntries.length === 0)
    .addOptions(
      (managedEntries.length
        ? managedEntries
        : [{ id: "none", label: "No entries", channelId: "0" }]
      )
        .slice(0, 25)
        .map((entry) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(entry.label)
            .setDescription(entry.id)
            .setValue(entry.id),
        ),
    );
  return {
    embeds: [
      panelEmbed({
        title: "Channels Panel",
        description: `Selected core slot: **${session.selectedChannelSlot ?? "none"}**\nPending managed channel: ${channelMention(session.pendingManagedChannelId)}`,
        fields: [
          { name: "Core channels", value: limitText(coreLines.join("\n"), 1000) },
          {
            name: "Managed channels",
            value: limitText(managed.length ? managed.join("\n") : "Nothing configured.", 1000),
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(slotSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(managedChannelSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(addButton),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeSelect),
    ],
  };
}

function renderFeaturesPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  const flags = { ...DEFAULT_GUILD_FEATURES, ...cfg.features };
  const featureSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "features", "toggle-one"))
    .setPlaceholder("Toggle a feature")
    .addOptions(
      Object.values(Features).map((feature) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(feature)
          .setDescription(flags[feature] ? "Currently enabled" : "Currently disabled")
          .setValue(feature),
      ),
    );
  return {
    embeds: [
      panelEmbed({
        title: "Features Panel",
        fields: Object.entries(flags).map(([name, enabled]) => ({
          name,
          value: yesNo(enabled),
          inline: true,
        })),
      }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(featureSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "features", "enable-all"))
          .setLabel("Enable all")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "features", "disable-all"))
          .setLabel("Disable all")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

export function renderFeatureConfigPanel(
  session: PanelState,
  cfg: GuildConfig,
  features: readonly RuntimeFeature[] = listConfigurableFeatures(),
): PanelPayload {
  const configurable = features.filter((feature) => feature.config);
  const selectedFeature = selectFeatureConfigModule(configurable, session.selectedFeatureConfigId);
  const fields = selectedFeature?.config ? Object.values(selectedFeature.config.fields) : [];
  const selectedField = selectFeatureConfigField(fields, session.selectedFeatureConfigField);
  const featureSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "feature-config", "feature"))
    .setPlaceholder("Choose feature")
    .setDisabled(configurable.length === 0)
    .addOptions(
      (configurable.length ? configurable : [{ id: "none" } as RuntimeFeature])
        .slice(0, 25)
        .map((feature) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(feature.id)
            .setDescription(
              feature.config
                ? `${Object.keys(feature.config.fields).length} configurable field(s)`
                : "No configurable features",
            )
            .setValue(feature.id)
            .setDefault(feature.id === selectedFeature?.id),
        ),
    );
  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "feature-config", "field"))
    .setPlaceholder("Choose config field")
    .setDisabled(fields.length === 0)
    .addOptions(
      (fields.length ? fields : [emptyConfigField()]).slice(0, 25).map((field) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(field.label)
          .setDescription(field.description ?? field.path)
          .setValue(field.key)
          .setDefault(field.key === selectedField?.key),
      ),
    );
  const components: PanelActionRow[] = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(featureSelect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelect),
  ];

  if (selectedField) {
    components.push(...featureConfigControls(session, selectedField));
  }

  return {
    embeds: [
      panelEmbed({
        title: "Feature Config Panel",
        description: selectedFeature
          ? `Selected feature: **${selectedFeature.id}**\nSelected field: **${selectedField?.label ?? "none"}**`
          : "No configurable features are currently loaded.",
        fields: fields.length
          ? fields.map((field) => ({
              name: field.label,
              value: `${formatFeatureConfigValue(field, getConfigPathValue(cfg, field.path))}\nPath: \`${field.path}\``,
              inline: true,
            }))
          : [{ name: "Fields", value: "No declared config fields.", inline: false }],
      }),
    ],
    components,
  };
}

function selectFeatureConfigModule(
  features: readonly RuntimeFeature[],
  selectedFeatureId: string | undefined,
): RuntimeFeature | undefined {
  return features.find((feature) => feature.id === selectedFeatureId) ?? features[0];
}

function selectFeatureConfigField(
  fields: readonly FeatureConfigField[],
  selectedFieldKey: string | undefined,
): FeatureConfigField | undefined {
  return fields.find((field) => field.key === selectedFieldKey) ?? fields[0];
}

function emptyConfigField(): FeatureConfigField {
  return {
    kind: "string",
    key: "none",
    label: "No fields",
    path: "none",
    required: false,
  };
}

function featureConfigControls(session: PanelState, field: FeatureConfigField): PanelActionRow[] {
  if (field.kind === "channel") {
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(makePanelCustomId(session, "feature-config", "set-channel"))
      .setPlaceholder(`Set ${field.label}`)
      .setMinValues(1)
      .setMaxValues(1);
    channelSelect.addChannelTypes(...field.channelTypes);
    return [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
      clearFeatureConfigRow(session),
    ];
  }

  if (field.kind === "boolean") {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "feature-config", "toggle-boolean"))
          .setLabel("Toggle")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "feature-config", "clear-field"))
          .setLabel("Clear")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }

  if (field.kind === "select") {
    const select = new StringSelectMenuBuilder()
      .setCustomId(makePanelCustomId(session, "feature-config", "select-option"))
      .setPlaceholder(`Set ${field.label}`)
      .addOptions(
        field.options
          .slice(0, 25)
          .map((option) =>
            new StringSelectMenuOptionBuilder().setLabel(option.label).setValue(option.value),
          ),
      );
    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      clearFeatureConfigRow(session),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makePanelCustomId(session, "feature-config", "value-modal"))
        .setLabel("Set value")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(makePanelCustomId(session, "feature-config", "clear-field"))
        .setLabel("Clear")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

function clearFeatureConfigRow(session: PanelState): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(makePanelCustomId(session, "feature-config", "clear-field"))
      .setLabel("Clear")
      .setStyle(ButtonStyle.Danger),
  );
}

function formatFeatureConfigValue(field: FeatureConfigField, value: unknown): string {
  if (value === null || value === undefined || value === "")
    return field.required ? "Not set (required)" : "Not set";
  if (field.kind === "channel" && typeof value === "string") return channelMention(value);
  if (field.kind === "boolean" && typeof value === "boolean") return yesNo(value);
  return limitText(value, 900);
}

function renderModerationPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  const mod = cfg.moderation;
  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "moderation", "channel-field"))
    .setPlaceholder("Choose moderation channel field")
    .addOptions(
      MODERATION_CHANNEL_FIELDS.map((field) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(field.label)
          .setValue(field.value)
          .setDefault(session.selectedModerationField === field.value),
      ),
    );
  return {
    embeds: [
      panelEmbed({
        title: "Moderation Panel",
        description: `Selected field: **${session.selectedModerationField ?? "none"}**`,
        fields: [
          {
            name: "Channels",
            value: [
              `Mod log: ${channelMention(mod.modLogChannelId)}`,
              `Appeals: ${channelMention(mod.appealsChannelId)}`,
              `Quarantine: ${channelMention(mod.quarantine.channelId)}`,
              `Verification: ${channelMention(mod.verification.channelId)}`,
            ].join("\n"),
          },
          {
            name: "Escalation",
            value: `${yesNo(mod.escalation.enabled)} - ${mod.escalation.thresholds.length} threshold(s)`,
            inline: true,
          },
          {
            name: "Quarantine",
            value: `${yesNo(mod.quarantine.enabled)}\nRole: ${roleMention(mod.quarantine.roleId)}`,
            inline: true,
          },
          {
            name: "Verification",
            value: `${yesNo(mod.verification.enabled)}\nMode: ${mod.verification.mode}\nRole: ${roleMention(mod.verification.roleId)}\nMin age: ${mod.verification.minAccountAgeDays}d`,
            inline: true,
          },
          { name: "Alt detection", value: yesNo(mod.altDetectionEnabled), inline: true },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "set-channel"))
          .setPlaceholder("Set chosen channel field")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "set-role"))
          .setPlaceholder("Set quarantine/verification role")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-alt"))
          .setLabel("Toggle alt")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-escalation"))
          .setLabel("Toggle escalation")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-quarantine"))
          .setLabel("Toggle quarantine")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "toggle-verification"))
          .setLabel("Toggle verification")
          .setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "verify-age-modal"))
          .setLabel("Set verify age")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "escalation-modal"))
          .setLabel("Add escalation")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "moderation", "clear-escalation"))
          .setLabel("Clear escalation")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

export function renderAutomodPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  const section = selectedAutomodSection(session);
  const automod = cfg.automod;
  const sectionSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "automod", "section"))
    .setPlaceholder("Choose automod section")
    .addOptions(
      AUTOMOD_SECTIONS.map((name) => {
        const item = automod[name] as { enabled?: boolean } | undefined;
        return new StringSelectMenuOptionBuilder()
          .setLabel(automodSectionLabel(name))
          .setDescription(item?.enabled ? "Enabled" : "Disabled")
          .setValue(name)
          .setDefault(section === name);
      }),
    );
  return {
    embeds: [
      panelEmbed({
        title: "Automod Panel",
        description: [
          `Editing **${automodSectionLabel(section)}**.`,
          "Use the menu to switch protections, then configure the selected section below.",
        ].join("\n"),
        fields: [
          automodSelectedField(section, cfg),
          automodCoverageField(cfg),
          automodPatternsField(cfg),
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "automod", "report-channel"))
          .setPlaceholder("Set report channel for selected section")
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
      ),
    ],
  };
}

function selectedAutomodSection(session: PanelState): AutomodSection {
  return AUTOMOD_SECTIONS.includes(session.selectedAutomodSection as AutomodSection)
    ? (session.selectedAutomodSection as AutomodSection)
    : "linkSpam";
}

function automodSectionLabel(section: AutomodSection): string {
  const labels: Record<AutomodSection, string> = {
    linkSpam: "Link spam",
    mentionSpam: "Mention spam",
    crossChannelSpam: "Cross-channel spam",
    slowmode: "Auto slowmode",
    raidDetection: "Raid detection",
    domainWhitelist: "Domain whitelist",
    shorteners: "Short links",
  };
  return labels[section];
}

function automodState(value: boolean): string {
  return value ? "Active" : "Off";
}

function automodActionLabel(action: string): string {
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

function automodSelectedField(section: AutomodSection, cfg: GuildConfig): APIEmbedField {
  const automod = cfg.automod;
  switch (section) {
    case "linkSpam":
      return {
        name: "Selected - Link spam",
        value: [
          `Status: **${automodState(automod.linkSpam.enabled)}**`,
          `Trigger: **${automod.linkSpam.maxLinks} links / ${automod.linkSpam.windowSeconds}s**`,
          `Response: **${automodActionLabel(automod.linkSpam.action)}**`,
          `Reports: ${channelMention(automod.linkSpam.reportChannelId)}`,
        ].join("\n"),
        inline: false,
      };
    case "mentionSpam":
      return {
        name: "Selected - Mention spam",
        value: [
          `Status: **${automodState(automod.mentionSpam.enabled)}**`,
          `Trigger: **${automod.mentionSpam.maxMentions} mentions / ${automod.mentionSpam.windowSeconds}s**`,
          `Response: **${automodActionLabel(automod.mentionSpam.action)}**`,
          `Timeout: **${automod.mentionSpam.timeoutSeconds}s**`,
          `Reports: ${channelMention(automod.mentionSpam.reportChannelId)}`,
        ].join("\n"),
        inline: false,
      };
    case "crossChannelSpam":
      return {
        name: "Selected - Cross-channel spam",
        value: [
          `Status: **${automodState(automod.crossChannelSpam.enabled)}**`,
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
          `Status: **${automodState(automod.slowmode.enabled)}**`,
          `Trigger: **${automod.slowmode.messagesPerWindow} messages / ${automod.slowmode.windowSeconds}s**`,
          `Applied rate: **${automod.slowmode.slowmodeSeconds}s**`,
          `Release after: **${automod.slowmode.releaseAfterSeconds}s**`,
        ].join("\n"),
        inline: false,
      };
    case "raidDetection":
      return {
        name: "Selected - Raid detection",
        value: [
          `Status: **${automodState(automod.raidDetection.enabled)}**`,
          `Trigger: **${automod.raidDetection.joinsPerMinute} joins/min**`,
          `New-account window: **${automod.raidDetection.minAccountAgeDays}d**`,
          `Response: **${automodActionLabel(automod.raidDetection.action)}**`,
          `Reports: ${channelMention(automod.raidDetection.reportChannelId)}`,
        ].join("\n"),
        inline: false,
      };
    case "domainWhitelist":
      return {
        name: "Selected - Domain whitelist",
        value: [
          `Status: **${automodState(automod.domainWhitelist.enabled)}**`,
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
          `Status: **${automodState(automod.shorteners.enabled)}**`,
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

function automodCoverageField(cfg: GuildConfig): APIEmbedField {
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
          `${enabled ? "On " : "Off"} - **${automodSectionLabel(section)}** (${detail})`,
      )
      .join("\n"),
    inline: false,
  };
}

function automodPatternsField(cfg: GuildConfig): APIEmbedField {
  const patterns = cfg.automod.customPatterns;
  return {
    name: "Custom patterns",
    value: patterns.length
      ? limitText(
          patterns
            .slice(0, 5)
            .map(
              (pattern) =>
                `**${pattern.name}** - ${automodActionLabel(pattern.action)} - \`/${pattern.pattern}/${pattern.flags}\``,
            )
            .join("\n"),
          900,
        )
      : "No custom regex patterns configured.",
    inline: false,
  };
}

async function renderRolesPanel(session: PanelState, cfg: GuildConfig): Promise<PanelPayload> {
  const roles = Object.entries(cfg.roles);
  const selected = session.selectedRoleIds;
  const action = session.selectedRoleAction;
  const performanceLines = await loadRolePerformance(session.guildId, selected);
  const selectedSummaries = selected.map((roleId) => {
    const rec = cfg.roles[roleId];
    const override = rec?.reach?.[action] ?? "inherit";
    const limit = rec?.limits?.[action];
    return `<@&${roleId}> - ${formatOverride(override)} - ${formatLimit(limit)}`;
  });
  return {
    embeds: [
      panelEmbed({
        title: "Role Moderation Panel",
        description: [
          `Selected action: **${action}**`,
          `Selected roles: ${selected.length ? selected.map((id) => `<@&${id}>`).join(", ") : "none"}`,
        ].join("\n"),
        fields: [
          {
            name: "Managed roles",
            value: roles.length
              ? limitText(
                  roles
                    .map(
                      ([key, role]) =>
                        `**${role.label}** (${key}) - ${roleMention(role.discordRoleId)}`,
                    )
                    .join("\n"),
                  1000,
                )
              : "No managed roles yet.",
          },
          {
            name: "Selected policy",
            value: selectedSummaries.length
              ? selectedSummaries.join("\n")
              : "Select roles to manage.",
          },
          {
            name: "Role performance",
            value: performanceLines.length
              ? performanceLines.join("\n")
              : "No post-panel moderation actions recorded for the selected roles.",
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "select-roles"))
          .setPlaceholder("Select Discord roles to manage")
          .setMinValues(1)
          .setMaxValues(10),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "action"))
          .setPlaceholder("Moderation action")
          .addOptions(
            MODERATION_ACTIONS.map((item) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(item.label)
                .setValue(item.key)
                .setDefault(action === item.key),
            ),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "register"))
          .setLabel("Register selected")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "override:allow"))
          .setLabel("Allow")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "override:deny"))
          .setLabel("Deny")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "override:inherit"))
          .setLabel("Inherit")
          .setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "limit-modal"))
          .setLabel("Configure limit")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "roles", "clear-limit"))
          .setLabel("Clear limit")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

async function renderAutorolesPanel(session: PanelState): Promise<PanelPayload> {
  const result = await listRules(session.guildId);
  const rules = result.isOk() ? result.unwrap() : [];
  return {
    embeds: [
      panelEmbed({
        title: "Autoroles Panel",
        fields: [
          {
            name: "Rules",
            value: rules.length
              ? limitText(
                  rules
                    .map(
                      (rule) =>
                        `${rule.enabled ? "On" : "Off"} **${rule.name}** -> ${roleMention(rule.roleId)} (${rule.trigger.type})`,
                    )
                    .join("\n"),
                  1000,
                )
              : "No rules configured.",
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "autoroles", "enable-all"))
          .setLabel("Enable all")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "autoroles", "disable-all"))
          .setLabel("Disable all")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

function renderTicketsPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  return renderChannelPairPanel(
    session,
    "tickets",
    "Tickets Panel",
    session.selectedTicketField,
    TICKET_FIELDS,
    [
      { name: "Prompt", value: channelMention(coreChannelValue(cfg, "tickets")), inline: true },
      {
        name: "Category",
        value: channelMention(
          cfg.channels.ticketCategoryId ?? coreChannelValue(cfg, "ticketCategory"),
        ),
        inline: true,
      },
      { name: "Logs", value: channelMention(coreChannelValue(cfg, "ticketLogs")), inline: true },
      { name: "Prompt message", value: cfg.channels.ticketMessageId ?? "Not posted", inline: true },
    ],
  );
}

function renderOffersPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  return renderChannelPairPanel(
    session,
    "offers",
    "Offers Panel",
    session.selectedOfferField,
    OFFER_FIELDS,
    [
      {
        name: "Review",
        value: channelMention(coreChannelValue(cfg, "offersReview")),
        inline: true,
      },
      {
        name: "Approved",
        value: channelMention(coreChannelValue(cfg, "approvedOffers")),
        inline: true,
      },
    ],
  );
}

function renderChannelPairPanel(
  session: PanelState,
  panelId: "tickets" | "offers",
  title: string,
  selectedField: string | undefined,
  fields: readonly { value: string; label: string }[],
  embedFields: APIEmbedField[],
): PanelPayload {
  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, panelId, "field"))
    .setPlaceholder("Choose channel field")
    .addOptions(
      fields.map((field) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(field.label)
          .setValue(field.value)
          .setDefault(selectedField === field.value),
      ),
    );
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, panelId, "set-channel"))
    .setPlaceholder("Set selected channel")
    .setMinValues(1)
    .setMaxValues(1);
  return {
    embeds: [
      panelEmbed({
        title,
        description: `Selected field: **${selectedField ?? "none"}**`,
        fields: embedFields,
      }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    ],
  };
}

function renderAiPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  const models = [
    ...Object.values(aiConfig.providers.openai),
    ...Object.values(aiConfig.providers.google),
  ].slice(0, 25);
  return {
    embeds: [
      panelEmbed({
        title: "AI Panel",
        fields: [
          { name: "Provider", value: cfg.ai.provider, inline: true },
          { name: "Model", value: `\`${cfg.ai.model}\``, inline: true },
          {
            name: "Rate limits",
            value: `${cfg.ai.rateLimit.perUserPerMinute}/user/min\n${cfg.ai.rateLimit.perGuildPerMinute}/guild/min`,
            inline: true,
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "ai", "provider"))
          .setPlaceholder("Set provider")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("Gemini")
              .setValue("gemini")
              .setDefault(cfg.ai.provider === "gemini"),
            new StringSelectMenuOptionBuilder()
              .setLabel("OpenAI")
              .setValue("openai")
              .setDefault(cfg.ai.provider === "openai"),
          ),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "ai", "model"))
          .setPlaceholder("Set model")
          .addOptions(
            models.map((model) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(model)
                .setValue(model)
                .setDefault(cfg.ai.model === model),
            ),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "ai", "rate-modal"))
          .setLabel("Set rate limits")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

function renderEconomyPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  const features = cfg.economy.features;
  return {
    embeds: [
      panelEmbed({
        title: "Economy Panel",
        fields: [
          {
            name: "Daily",
            value: `${cfg.economy.daily.dailyReward} ${cfg.economy.daily.dailyCurrencyId}\nCooldown ${cfg.economy.daily.dailyCooldownHours}h\nFee ${(cfg.economy.daily.dailyFeeRate * 100).toFixed(2)}%`,
            inline: true,
          },
          {
            name: "Work",
            value: `Base ${cfg.economy.work.workBaseMintReward}\nBonus max ${cfg.economy.work.workBonusFromWorksMax}\nCooldown ${cfg.economy.work.workCooldownMinutes}m\nCap ${cfg.economy.work.workDailyCap}`,
            inline: true,
          },
          {
            name: "Tax",
            value: `${yesNo(cfg.economy.tax.enabled)}\nRate ${(cfg.economy.tax.rate * 100).toFixed(1)}%\nMin ${cfg.economy.tax.minimumTaxableAmount}`,
            inline: true,
          },
          {
            name: "Sectors",
            value:
              Object.entries(cfg.economy.sectors ?? {})
                .map(([name, value]) => `${name}: ${value}`)
                .join("\n") || "None",
            inline: true,
          },
          {
            name: "Features",
            value: Object.entries(features)
              .map(([name, enabled]) => `${name}: ${yesNo(enabled)}`)
              .join("\n"),
            inline: true,
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "feature-toggle"))
          .setPlaceholder("Toggle economy feature")
          .addOptions(
            Object.entries(features).map(([name, enabled]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(name)
                .setDescription(enabled ? "Enabled" : "Disabled")
                .setValue(name),
            ),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "daily-modal"))
          .setLabel("Daily config")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "work-modal"))
          .setLabel("Work config")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "tax-modal"))
          .setLabel("Tax config")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

function renderReputationPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  return {
    embeds: [
      panelEmbed({
        title: "Reputation Panel",
        fields: [
          { name: "Detection", value: yesNo(cfg.reputation.detectionEnabled), inline: true },
          {
            name: "Request channel",
            value: channelMention(
              cfg.reputation.requestChannelId ?? coreChannelValue(cfg, "repRequests"),
            ),
            inline: true,
          },
          {
            name: "Keywords",
            value: cfg.reputation.keywords.length ? cfg.reputation.keywords.join(", ") : "None",
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "reputation", "channel"))
          .setPlaceholder("Set reputation request channel")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "reputation", "toggle"))
          .setLabel("Toggle detection")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "reputation", "keywords-modal"))
          .setLabel("Set keywords")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

function renderForumsPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  return {
    embeds: [
      panelEmbed({
        title: "Forums Panel",
        fields: [
          { name: "Auto-reply", value: yesNo(cfg.forumAutoReply.enabled), inline: true },
          {
            name: "Forums",
            value: cfg.forumAutoReply.forumIds.length
              ? cfg.forumAutoReply.forumIds.map((id) => `<#${id}>`).join("\n")
              : "None",
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "forums", "channels"))
          .setPlaceholder("Set forum auto-reply channels")
          .addChannelTypes(ChannelType.GuildForum)
          .setMinValues(1)
          .setMaxValues(10),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "forums", "toggle"))
          .setLabel("Toggle auto-reply")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "forums", "clear"))
          .setLabel("Clear forums")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

function renderTopsPanel(session: PanelState, cfg: GuildConfig): PanelPayload {
  return {
    embeds: [
      panelEmbed({
        title: "Tops Panel",
        fields: [
          { name: "Enabled", value: yesNo(cfg.tops.enabled), inline: true },
          { name: "Channel", value: channelMention(cfg.tops.channelId), inline: true },
          {
            name: "Cadence",
            value: `Every ${cfg.tops.intervalHours}h\nTop ${cfg.tops.topSize}`,
            inline: true,
          },
        ],
      }),
    ],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "tops", "channel"))
          .setPlaceholder("Set tops report channel")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "tops", "toggle"))
          .setLabel("Toggle tops")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "tops", "config-modal"))
          .setLabel("Set cadence")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

async function applyPanelAction(
  interaction: ComponentInteraction,
  session: PanelState,
  panelId: PanelId,
  action: string,
): Promise<boolean> {
  if (action === "refresh") return true;
  if (action === "nav" && interaction.isStringSelectMenu()) {
    const next = interaction.values[0];
    if (next) session.panelId = next as PanelId;
    return true;
  }
  if (panelId === "channels") return applyChannelsAction(interaction, session, action);
  if (panelId === "features") return applyFeaturesAction(interaction, session, action);
  if (panelId === "feature-config") return applyFeatureConfigAction(interaction, session, action);
  if (panelId === "moderation") return applyModerationAction(interaction, session, action);
  if (panelId === "automod") return applyAutomodAction(interaction, session, action);
  if (panelId === "roles") return applyRolesAction(interaction, session, action);
  if (panelId === "autoroles") return applyAutorolesAction(session, action);
  if (panelId === "tickets") return applyTicketsAction(interaction, session, action);
  if (panelId === "ai") return applyAiAction(interaction, session, action);
  if (panelId === "offers") return applyOffersAction(interaction, session, action);
  if (panelId === "economy") return applyEconomyAction(interaction, session, action);
  if (panelId === "reputation") return applyReputationAction(interaction, session, action);
  if (panelId === "forums") return applyForumsAction(interaction, session, action);
  if (panelId === "tops") return applyTopsAction(interaction, session, action);
  return true;
}

async function applyChannelsAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && action === "slot") {
    session.selectedChannelSlot = interaction.values[0] ?? session.selectedChannelSlot;
    return true;
  }
  if (interaction.isChannelSelectMenu() && action === "set-core") {
    const slot = session.selectedChannelSlot;
    if (!slot) throw new Error("Choose a core channel slot first.");
    const channelId = interaction.values[0];
    const patch: Record<string, unknown> = { [`channels.core.${slot}`]: { channelId } };
    if (slot === "ticketCategory") patch["channels.ticketCategoryId"] = channelId;
    await updateGuildPaths(session.guildId, patch, { upsert: true });
    return true;
  }
  if (interaction.isChannelSelectMenu() && action === "managed-channel") {
    session.pendingManagedChannelId = interaction.values[0];
    return true;
  }
  if (action === "managed-add-modal" && interaction.isButton()) {
    if (!session.pendingManagedChannelId)
      throw new Error("Pick a channel before adding a managed entry.");
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "channels", "managed-add-submit"))
      .setTitle("Add managed channel")
      .addComponents(modalInput("label", "Label", "staff-alerts", true));
    await interaction.showModal(modal);
    return false;
  }
  if (action === "managed-add-submit" && interaction.isModalSubmit()) {
    const label = interaction.fields.getTextInputValue("label").trim();
    const id =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || Date.now().toString(36);
    await updateGuildPaths(
      session.guildId,
      { [`channels.managed.${id}`]: { id, label, channelId: session.pendingManagedChannelId } },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isStringSelectMenu() && action === "managed-remove") {
    const id = interaction.values[0];
    if (id && id !== "none")
      await updateGuildPaths(session.guildId, {}, { unset: [`channels.managed.${id}`] });
  }
  return true;
}

async function applyFeaturesAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (interaction.isStringSelectMenu() && action === "toggle-one") {
    const feature = interaction.values[0];
    const current = Boolean((cfg.features as Record<string, boolean>)[feature]);
    await updateGuildPaths(
      session.guildId,
      { [`features.${feature}`]: !current },
      { upsert: true },
    );
    if (feature === "autoroles" && current) await disableAllAutoroles(session.guildId);
    return true;
  }
  if (action === "enable-all" || action === "disable-all") {
    const enabled = action === "enable-all";
    await updateGuildPaths(
      session.guildId,
      Object.fromEntries(
        Object.values(Features).map((feature) => [`features.${feature}`, enabled]),
      ),
      { upsert: true },
    );
    if (!enabled) await disableAllAutoroles(session.guildId);
  }
  return true;
}

export async function applyFeatureConfigAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
  features: readonly RuntimeFeature[] = listConfigurableFeatures(),
): Promise<boolean> {
  const configurable = features.filter((feature) => feature.config);
  if (interaction.isStringSelectMenu() && action === "feature") {
    session.selectedFeatureConfigId = interaction.values[0];
    session.selectedFeatureConfigField = undefined;
    return true;
  }
  if (interaction.isStringSelectMenu() && action === "field") {
    session.selectedFeatureConfigField = interaction.values[0];
    return true;
  }

  const cfg = await loadGuildConfig(session.guildId);
  const feature = selectFeatureConfigModule(configurable, session.selectedFeatureConfigId);
  if (!feature?.config) throw new Error("Choose a configurable feature first.");
  const field = selectFeatureConfigField(
    Object.values(feature.config.fields),
    session.selectedFeatureConfigField,
  );
  if (!field) throw new Error("Choose a config field first.");

  if (interaction.isChannelSelectMenu() && action === "set-channel") {
    await writeFeatureConfigField(session.guildId, feature, field, interaction.values[0]);
    return true;
  }
  if (interaction.isStringSelectMenu() && action === "select-option") {
    await writeFeatureConfigField(session.guildId, feature, field, interaction.values[0]);
    return true;
  }
  if (action === "toggle-boolean") {
    const current = Boolean(getConfigPathValue(cfg, field.path));
    await writeFeatureConfigField(session.guildId, feature, field, !current);
    return true;
  }
  if (action === "clear-field") {
    await writeFeatureConfigField(session.guildId, feature, field, null);
    return true;
  }
  if (action === "value-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "feature-config", "value-submit"))
      .setTitle(`Set ${field.label}`)
      .addComponents(
        modalInput(
          "value",
          field.label,
          String(getConfigPathValue(cfg, field.path) ?? ""),
          field.required,
        ),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (action === "value-submit" && interaction.isModalSubmit()) {
    const value = coerceFeatureConfigValue(field, interaction.fields.getTextInputValue("value"));
    await writeFeatureConfigField(session.guildId, feature, field, value);
  }
  return true;
}

async function writeFeatureConfigField(
  guildId: string,
  feature: RuntimeFeature,
  field: FeatureConfigField,
  value: unknown,
): Promise<void> {
  if (!feature.config) throw new Error("Feature has no config definition.");
  const patch = buildConfigFieldPatch(feature.config, field.key, value);
  if (patch.isErr()) throw new Error(patch.error.message);
  await updateGuildPaths(guildId, patch.unwrap(), { upsert: true });
}

function coerceFeatureConfigValue(field: FeatureConfigField, value: string): unknown {
  if (field.kind === "number") {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new Error(`${field.label} must be numeric.`);
    return field.integer ? Math.trunc(numberValue) : numberValue;
  }
  return value;
}

async function applyModerationAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (interaction.isStringSelectMenu() && action === "channel-field") {
    session.selectedModerationField = interaction.values[0];
    return true;
  }
  if (interaction.isChannelSelectMenu() && action === "set-channel") {
    if (!session.selectedModerationField)
      throw new Error("Choose a moderation channel field first.");
    await updateGuildPaths(
      session.guildId,
      { [session.selectedModerationField]: interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isRoleSelectMenu() && action === "set-role") {
    const field = session.selectedModerationField?.includes("verification")
      ? "moderation.verification.roleId"
      : "moderation.quarantine.roleId";
    await updateGuildPaths(session.guildId, { [field]: interaction.values[0] }, { upsert: true });
    return true;
  }
  if (action === "toggle-alt")
    await updateGuildPaths(
      session.guildId,
      { "moderation.altDetectionEnabled": !cfg.moderation.altDetectionEnabled },
      { upsert: true },
    );
  if (action === "toggle-escalation")
    await updateGuildPaths(
      session.guildId,
      { "moderation.escalation.enabled": !cfg.moderation.escalation.enabled },
      { upsert: true },
    );
  if (action === "toggle-quarantine")
    await updateGuildPaths(
      session.guildId,
      { "moderation.quarantine.enabled": !cfg.moderation.quarantine.enabled },
      { upsert: true },
    );
  if (action === "toggle-verification")
    await updateGuildPaths(
      session.guildId,
      { "moderation.verification.enabled": !cfg.moderation.verification.enabled },
      { upsert: true },
    );
  if (action === "clear-escalation")
    await updateGuildPaths(
      session.guildId,
      { "moderation.escalation.thresholds": [] },
      { upsert: true },
    );
  if (action === "verify-age-modal" && interaction.isButton()) {
    await showOneInputModal(
      interaction,
      session,
      "moderation",
      "verify-age-submit",
      "Verification age",
      "days",
      "Minimum account age in days",
      "0",
    );
    return false;
  }
  if (action === "verify-age-submit" && interaction.isModalSubmit()) {
    const days = Number(interaction.fields.getTextInputValue("days"));
    if (!Number.isInteger(days) || days < 0 || days > 365)
      throw new Error("Age must be a whole number from 0 to 365.");
    await updateGuildPaths(
      session.guildId,
      { "moderation.verification.minAccountAgeDays": days },
      { upsert: true },
    );
  }
  if (action === "escalation-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "moderation", "escalation-submit"))
      .setTitle("Add escalation threshold")
      .addComponents(
        modalInput("warns", "Warn count", "3", true),
        modalInput("action", "Action: timeout, kick, ban", "timeout", true),
        modalInput("duration", "Timeout duration", "1h", false),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (action === "escalation-submit" && interaction.isModalSubmit()) {
    const warnCount = Number(interaction.fields.getTextInputValue("warns"));
    const thresholdAction = interaction.fields.getTextInputValue("action").trim().toLowerCase();
    const durationKey = interaction.fields.getTextInputValue("duration").trim() || undefined;
    if (!Number.isInteger(warnCount) || warnCount < 1)
      throw new Error("Warn count must be a positive whole number.");
    if (!["timeout", "kick", "ban"].includes(thresholdAction))
      throw new Error("Action must be timeout, kick, or ban.");
    await updateGuildPaths(
      session.guildId,
      {
        "moderation.escalation.thresholds": [
          ...cfg.moderation.escalation.thresholds,
          {
            warnCount,
            action: thresholdAction as "timeout" | "kick" | "ban",
            ...(durationKey ? { durationKey } : {}),
          },
        ],
      },
      { upsert: true },
    );
  }
  return true;
}

async function applyAutomodAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  const section = session.selectedAutomodSection ?? "linkSpam";
  const automod = cfg.automod as unknown as Record<string, { enabled?: boolean }>;
  if (interaction.isStringSelectMenu() && action === "section") {
    session.selectedAutomodSection = interaction.values[0];
    return true;
  }
  if (action === "toggle") {
    await updateGuildPaths(
      session.guildId,
      { [`automod.${section}.enabled`]: !automod[section]?.enabled },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isChannelSelectMenu() && action === "report-channel") {
    if (!["linkSpam", "mentionSpam", "crossChannelSpam", "raidDetection"].includes(section))
      throw new Error("Selected automod section has no report channel.");
    await updateGuildPaths(
      session.guildId,
      { [`automod.${section}.reportChannelId`]: interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (action === "config-modal" && interaction.isButton()) {
    await showAutomodConfigModal(interaction, session, section);
    return false;
  }
  if (action === "config-submit" && interaction.isModalSubmit()) {
    await saveAutomodConfig(interaction, session, section);
    return true;
  }
  if (action === "pattern-modal" && interaction.isButton()) {
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
  if (action === "pattern-submit" && interaction.isModalSubmit()) {
    const name = interaction.fields.getTextInputValue("name").trim();
    const pattern = interaction.fields.getTextInputValue("regex");
    const flags = interaction.fields.getTextInputValue("flags").trim() || "i";
    const response = interaction.fields.getTextInputValue("response").trim() || "delete";
    new RegExp(pattern, flags);
    await updateGuildPaths(
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
  if (action === "clear-patterns") {
    await updateGuildPaths(session.guildId, { "automod.customPatterns": [] }, { upsert: true });
    invalidatePatternCache(session.guildId);
  }
  return true;
}

async function applyRolesAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  if (interaction.isRoleSelectMenu() && action === "select-roles") {
    session.selectedRoleIds = [...interaction.values];
    return true;
  }
  if (interaction.isStringSelectMenu() && action === "action") {
    session.selectedRoleAction = interaction.values[0] ?? session.selectedRoleAction;
    return true;
  }
  if (action === "register") {
    const guild = interaction.guild;
    if (!guild) throw new Error("This panel needs a server.");
    const patch: Record<string, unknown> = {};
    for (const roleId of session.selectedRoleIds) {
      const role =
        guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
      patch[`roles.${roleId}`] = createRoleRecord(
        roleId,
        role?.name ?? roleId,
        interaction.user.id,
      );
    }
    if (Object.keys(patch).length === 0) throw new Error("Select at least one role first.");
    await updateGuildPaths(session.guildId, patch, { upsert: true });
    return true;
  }
  if (action.startsWith("override:")) {
    const override = action.slice("override:".length) as RoleCommandOverride;
    await patchSelectedRoleRecords(session, (role) => {
      role.reach[session.selectedRoleAction] = override;
    });
    return true;
  }
  if (action === "clear-limit") {
    await patchSelectedRoleRecords(session, (role) => {
      delete role.limits[session.selectedRoleAction];
    });
    return true;
  }
  if (action === "limit-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "roles", "limit-submit"))
      .setTitle("Role action limit")
      .addComponents(
        modalInput("count", "Maximum uses (0 removes)", "5", true),
        modalInput("window", "Window: 10m, 1h, 24h", "1h", false),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (action === "limit-submit" && interaction.isModalSubmit()) {
    const count = Number(interaction.fields.getTextInputValue("count"));
    if (!Number.isInteger(count) || count < 0)
      throw new Error("Limit must be a whole number 0 or greater.");
    const parsed = parseLimitWindow(interaction.fields.getTextInputValue("window"));
    if (!parsed.ok) throw new Error(parsed.error);
    await patchSelectedRoleRecords(session, (role) => {
      if (count === 0) {
        delete role.limits[session.selectedRoleAction];
        return;
      }
      role.limits[session.selectedRoleAction] = {
        limit: count,
        window: parsed.value,
        windowSeconds: parsed.seconds,
      } satisfies RoleLimitRecord;
    });
  }
  return true;
}

async function applyAutorolesAction(session: PanelState, action: string): Promise<boolean> {
  if (action === "enable-all" || action === "disable-all") {
    const enabled = action === "enable-all";
    const result = await listRules(session.guildId);
    if (result.isOk())
      for (const rule of result.unwrap()) await setEnabled(session.guildId, rule.name, enabled);
  }
  return true;
}

async function applyTicketsAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && action === "field") {
    session.selectedTicketField = interaction.values[0];
    return true;
  }
  if (interaction.isChannelSelectMenu() && action === "set-channel") {
    if (!session.selectedTicketField) throw new Error("Choose a ticket field first.");
    const channelId = interaction.values[0];
    if (session.selectedTicketField === "channels.ticketCategoryId") {
      await updateGuildPaths(
        session.guildId,
        { "channels.ticketCategoryId": channelId, "channels.core.ticketCategory": { channelId } },
        { upsert: true },
      );
    } else {
      await updateGuildPaths(
        session.guildId,
        { [session.selectedTicketField]: { channelId } },
        { upsert: true },
      );
    }
  }
  return true;
}

async function applyOffersAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && action === "field") {
    session.selectedOfferField = interaction.values[0];
    return true;
  }
  if (interaction.isChannelSelectMenu() && action === "set-channel") {
    if (!session.selectedOfferField) throw new Error("Choose an offer channel field first.");
    await updateGuildPaths(
      session.guildId,
      { [session.selectedOfferField]: { channelId: interaction.values[0] } },
      { upsert: true },
    );
  }
  return true;
}

async function applyAiAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && action === "provider") {
    const provider = interaction.values[0];
    const defaultModel =
      provider === "openai" ? aiConfig.providers.openai.low : aiConfig.providers.google.low;
    await updateGuildPaths(
      session.guildId,
      { "ai.provider": provider, "ai.model": defaultModel },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isStringSelectMenu() && action === "model") {
    await updateGuildPaths(
      session.guildId,
      { "ai.model": interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (action === "rate-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "ai", "rate-submit"))
      .setTitle("AI rate limits")
      .addComponents(
        modalInput("user", "Per user per minute", "8", true),
        modalInput("guild", "Per guild per minute", "60", true),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (action === "rate-submit" && interaction.isModalSubmit()) {
    const perUser = Number(interaction.fields.getTextInputValue("user"));
    const perGuild = Number(interaction.fields.getTextInputValue("guild"));
    if (!Number.isInteger(perUser) || perUser < 0 || !Number.isInteger(perGuild) || perGuild < 0)
      throw new Error("Rate limits must be whole numbers.");
    await updateGuildPaths(
      session.guildId,
      { "ai.rateLimit.perUserPerMinute": perUser, "ai.rateLimit.perGuildPerMinute": perGuild },
      { upsert: true },
    );
  }
  return true;
}

async function applyEconomyAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (interaction.isStringSelectMenu() && action === "feature-toggle") {
    const feature = interaction.values[0];
    const current = Boolean((cfg.economy.features as Record<string, boolean>)[feature]);
    await updateGuildPaths(
      session.guildId,
      { [`economy.features.${feature}`]: !current },
      { upsert: true },
    );
    return true;
  }
  if (action.endsWith("-modal") && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "economy", `${action.replace("-modal", "")}-submit`))
      .setTitle("Economy config")
      .addComponents(
        modalInput("a", "Value A", "0", true),
        modalInput("b", "Value B", "0", false),
        modalInput("c", "Value C", "0", false),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (interaction.isModalSubmit()) {
    const a = Number(interaction.fields.getTextInputValue("a"));
    const b = Number(interaction.fields.getTextInputValue("b") || "0");
    const c = Number(interaction.fields.getTextInputValue("c") || "0");
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c))
      throw new Error("Economy values must be numeric.");
    if (action === "daily-submit")
      await updateGuildPaths(
        session.guildId,
        {
          "economy.daily.dailyReward": Math.trunc(a),
          "economy.daily.dailyCooldownHours": Math.trunc(b || cfg.economy.daily.dailyCooldownHours),
          "economy.daily.dailyFeeRate": c || cfg.economy.daily.dailyFeeRate,
        },
        { upsert: true },
      );
    if (action === "work-submit")
      await updateGuildPaths(
        session.guildId,
        {
          "economy.work.workBaseMintReward": Math.trunc(a),
          "economy.work.workBonusFromWorksMax": Math.trunc(b),
          "economy.work.workDailyCap": Math.trunc(c || cfg.economy.work.workDailyCap),
        },
        { upsert: true },
      );
    if (action === "tax-submit")
      await updateGuildPaths(
        session.guildId,
        {
          "economy.tax.rate": a,
          "economy.tax.minimumTaxableAmount": Math.trunc(b),
          "economy.tax.enabled": c > 0,
        },
        { upsert: true },
      );
  }
  return true;
}

async function applyReputationAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (action === "toggle")
    await updateGuildPaths(
      session.guildId,
      { "reputation.detectionEnabled": !cfg.reputation.detectionEnabled },
      { upsert: true },
    );
  if (interaction.isChannelSelectMenu() && action === "channel")
    await updateGuildPaths(
      session.guildId,
      {
        "reputation.requestChannelId": interaction.values[0],
        "channels.core.repRequests": { channelId: interaction.values[0] },
      },
      { upsert: true },
    );
  if (action === "keywords-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "reputation", "keywords-submit"))
      .setTitle("Reputation keywords")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("keywords")
            .setLabel("Comma-separated keywords")
            .setPlaceholder("thanks, +rep, good trade")
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph),
        ),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (action === "keywords-submit" && interaction.isModalSubmit()) {
    const keywords = parseReputationKeywords(interaction.fields.getTextInputValue("keywords"));
    const result = await updateGuildPaths(
      session.guildId,
      { "reputation.keywords": keywords },
      { upsert: true },
    );
    if (result.isErr()) throw result.error;
  }
  return true;
}

export function parseReputationKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const keywords = raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
    .filter((keyword) => {
      const key = keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (keywords.length > 25) {
    throw new Error("Use 25 or fewer reputation keywords.");
  }

  const tooLong = keywords.find((keyword) => keyword.length > 64);
  if (tooLong) {
    throw new Error(
      `Reputation keyword "${tooLong.slice(0, 20)}" is too long; use 64 characters or fewer.`,
    );
  }

  return keywords;
}

async function applyForumsAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (action === "toggle")
    await updateGuildPaths(
      session.guildId,
      { "forumAutoReply.enabled": !cfg.forumAutoReply.enabled },
      { upsert: true },
    );
  if (action === "clear")
    await updateGuildPaths(session.guildId, { "forumAutoReply.forumIds": [] }, { upsert: true });
  if (interaction.isChannelSelectMenu() && action === "channels")
    await updateGuildPaths(
      session.guildId,
      { "forumAutoReply.forumIds": interaction.values, "forumAutoReply.enabled": true },
      { upsert: true },
    );
  return true;
}

async function applyTopsAction(
  interaction: ComponentInteraction,
  session: PanelState,
  action: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (action === "toggle")
    await updateGuildPaths(
      session.guildId,
      { "tops.enabled": !cfg.tops.enabled },
      { upsert: true },
    );
  if (interaction.isChannelSelectMenu() && action === "channel")
    await updateGuildPaths(
      session.guildId,
      { "tops.channelId": interaction.values[0] },
      { upsert: true },
    );
  if (action === "config-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "tops", "config-submit"))
      .setTitle("Tops cadence")
      .addComponents(
        modalInput("hours", "Interval hours", "24", true),
        modalInput("size", "Top size", "10", true),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (action === "config-submit" && interaction.isModalSubmit()) {
    const hours = Number(interaction.fields.getTextInputValue("hours"));
    const size = Number(interaction.fields.getTextInputValue("size"));
    if (!Number.isInteger(hours) || hours < 1 || !Number.isInteger(size) || size < 1 || size > 25)
      throw new Error("Use interval >= 1 and top size 1-25.");
    await updateGuildPaths(
      session.guildId,
      { "tops.intervalHours": hours, "tops.topSize": size },
      { upsert: true },
    );
  }
  return true;
}

async function disableAllAutoroles(guildId: string): Promise<void> {
  const rules = await listRules(guildId);
  if (!rules.isOk()) return;
  for (const rule of rules.unwrap()) if (rule.enabled) await setEnabled(guildId, rule.name, false);
}

async function patchSelectedRoleRecords(
  session: PanelState,
  mutate: (role: GuildRoleRecord) => void,
): Promise<void> {
  const cfg = await loadGuildConfig(session.guildId);
  const patch: Record<string, unknown> = {};
  for (const roleId of session.selectedRoleIds) {
    const existing = cfg.roles[roleId] ?? createRoleRecord(roleId, roleId, session.ownerId);
    const next: GuildRoleRecord = {
      ...existing,
      reach: { ...existing.reach },
      limits: { ...existing.limits },
      updatedBy: session.ownerId,
      updatedAt: new Date().toISOString(),
    };
    mutate(next);
    patch[`roles.${roleId}`] = next;
  }
  if (Object.keys(patch).length === 0) throw new Error("Select at least one role first.");
  await updateGuildPaths(session.guildId, patch, { upsert: true });
}

async function loadRolePerformance(guildId: string, roleIds: readonly string[]): Promise<string[]> {
  if (!roleIds.length) return [];
  const db = await getDb();
  const docs = await db
    .collection("users")
    .find(
      { [`sanction_history.${guildId}`]: { $exists: true } },
      { projection: { sanction_history: 1 } },
    )
    .limit(500)
    .toArray();
  const counts = new Map<string, number>(roleIds.map((id) => [id, 0]));
  let prePanel = 0;
  for (const doc of docs) {
    const entries =
      (doc as { sanction_history?: Record<string, Array<{ moderatorRoleIds?: string[] }>> })
        .sanction_history?.[guildId] ?? [];
    for (const entry of entries) {
      if (!entry.moderatorRoleIds) {
        prePanel += 1;
        continue;
      }
      for (const roleId of roleIds)
        if (entry.moderatorRoleIds.includes(roleId))
          counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
    }
  }
  return [
    ...[...counts.entries()].map(([roleId, count]) => `<@&${roleId}>: ${count} recorded action(s)`),
    prePanel ? `${prePanel} older action(s) have no role snapshot.` : "",
  ].filter(Boolean);
}

function modalInput(
  customId: string,
  label: string,
  placeholder: string,
  required: boolean,
): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setPlaceholder(placeholder)
      .setRequired(required)
      .setStyle(TextInputStyle.Short),
  );
}

async function showOneInputModal(
  interaction: ComponentInteraction,
  session: PanelState,
  panelId: PanelId,
  action: string,
  title: string,
  customId: string,
  label: string,
  placeholder: string,
): Promise<void> {
  if (!interaction.isButton()) throw new Error("This action must be opened from a button.");
  const modal = new ModalBuilder()
    .setCustomId(makePanelCustomId(session, panelId, action))
    .setTitle(title)
    .addComponents(modalInput(customId, label, placeholder, true));
  await interaction.showModal(modal);
}

async function showAutomodConfigModal(
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
  } else {
    modal.addComponents(
      modalInput("a", "Primary number", "4", false),
      modalInput("b", "Window seconds", "10", false),
      modalInput("c", "Action or duration", "timeout", false),
    );
  }
  await interaction.showModal(modal);
}

async function saveAutomodConfig(
  interaction: ComponentInteraction,
  session: PanelState,
  section: string,
): Promise<void> {
  if (!interaction.isModalSubmit()) return;
  if (section === "domainWhitelist") {
    const domains = interaction.fields
      .getTextInputValue("domains")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    await updateGuildPaths(
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
  const numberA = a ? Number(a) : null;
  const numberB = b ? Number(b) : null;
  if (numberA !== null && !Number.isFinite(numberA))
    throw new Error("Primary number must be numeric.");
  if (numberB !== null && !Number.isFinite(numberB))
    throw new Error("Window seconds must be numeric.");
  if (section === "linkSpam") {
    if (numberA !== null) patch["automod.linkSpam.maxLinks"] = Math.trunc(numberA);
    if (numberB !== null) patch["automod.linkSpam.windowSeconds"] = Math.trunc(numberB);
    if (c) patch["automod.linkSpam.action"] = c;
  } else if (section === "mentionSpam") {
    if (numberA !== null) patch["automod.mentionSpam.maxMentions"] = Math.trunc(numberA);
    if (numberB !== null) patch["automod.mentionSpam.windowSeconds"] = Math.trunc(numberB);
    if (c) patch["automod.mentionSpam.action"] = c;
  } else if (section === "crossChannelSpam") {
    if (numberA !== null) patch["automod.crossChannelSpam.minChannels"] = Math.trunc(numberA);
    if (numberB !== null) patch["automod.crossChannelSpam.windowSeconds"] = Math.trunc(numberB);
    if (c) patch["automod.crossChannelSpam.timeoutSeconds"] = Math.trunc(Number(c));
  } else if (section === "slowmode") {
    if (numberA !== null) patch["automod.slowmode.messagesPerWindow"] = Math.trunc(numberA);
    if (numberB !== null) patch["automod.slowmode.windowSeconds"] = Math.trunc(numberB);
    if (c) patch["automod.slowmode.slowmodeSeconds"] = Math.trunc(Number(c));
  } else if (section === "raidDetection") {
    if (numberA !== null) patch["automod.raidDetection.joinsPerMinute"] = Math.trunc(numberA);
    if (numberB !== null) patch["automod.raidDetection.minAccountAgeDays"] = Math.trunc(numberB);
    if (c) patch["automod.raidDetection.action"] = c;
  } else if (section === "shorteners") {
    patch["automod.shorteners.resolveFinalUrl"] = c === "true" || c === "yes" || c === "1";
  }
  if (Object.keys(patch).length) await updateGuildPaths(session.guildId, patch, { upsert: true });
}

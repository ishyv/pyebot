import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { getDb } from "@/core/db";
import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type {
  Guild as GuildConfig,
  GuildRoleRecord,
  RoleCommandOverride,
  RoleLimitRecord,
} from "@/db/schemas/guild";
import { limitText, loadGuildConfig, modalInput, roleMention } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";
import {
  createRoleRecord,
  formatLimit,
  formatOverride,
  MODERATION_ACTIONS,
  parseLimitWindow,
} from "../rolePolicy";

/** Loads per-role action counts from sanction history for the selected roles. */
async function loadPerformance(guildId: string, roleIds: readonly string[]): Promise<string[]> {
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

async function patchSelected(
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

/** Renders managed roles, selected-role policy summary, and performance metrics. */
export async function render(session: PanelState, cfg: GuildConfig): Promise<PanelPayload> {
  const roles = Object.entries(cfg.roles);
  const selected = session.selectedRoleIds;
  const actionKey = session.selectedRoleAction;
  const performanceLines = await loadPerformance(session.guildId, selected);
  const selectedSummaries = selected.map((roleId) => {
    const rec = cfg.roles[roleId];
    const override = rec?.reach?.[actionKey] ?? "inherit";
    const limit = rec?.limits?.[actionKey];
    return `<@&${roleId}> - ${formatOverride(override)} - ${formatLimit(limit)}`;
  });
  return {
    container: panelContainer({
      title: "Role Moderation Panel",
      description: [
        `Selected action: **${actionKey}**`,
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
    actionRows: [
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
                .setDefault(actionKey === item.key),
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

/** Handles role selection, action pick, register, override, and limit modal. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  if (interaction.isRoleSelectMenu() && actionStr === "select-roles") {
    session.selectedRoleIds = [...interaction.values];
    return true;
  }
  if (interaction.isStringSelectMenu() && actionStr === "action") {
    session.selectedRoleAction = interaction.values[0] ?? session.selectedRoleAction;
    return true;
  }
  if (actionStr === "register") {
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
  if (actionStr.startsWith("override:")) {
    const override = actionStr.slice("override:".length) as RoleCommandOverride;
    await patchSelected(session, (role) => {
      role.reach[session.selectedRoleAction] = override;
    });
    return true;
  }
  if (actionStr === "clear-limit") {
    await patchSelected(session, (role) => {
      delete role.limits[session.selectedRoleAction];
    });
    return true;
  }
  if (actionStr === "limit-modal" && interaction.isButton()) {
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
  if (actionStr === "limit-submit" && interaction.isModalSubmit()) {
    const count = Number(interaction.fields.getTextInputValue("count"));
    if (!Number.isInteger(count) || count < 0)
      throw new Error("Limit must be a whole number 0 or greater.");
    const parsed = parseLimitWindow(interaction.fields.getTextInputValue("window"));
    if (!parsed.ok) throw new Error(parsed.error);
    await patchSelected(session, (role) => {
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

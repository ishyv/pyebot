import {
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { createLogger } from "@/core/logger";
import { getEmbedConfig, listEmbedConfigs, patchEmbedConfig } from "@/db/repositories/embeds";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import type { ContainerChild } from "@/ui/v2";
import { container, row, section, separator, text } from "@/ui/v2";
import { renderEmbedPreview, sendEmbed } from "../service";
import { type EmbedConfigDraft, embedWizardSessions, renderWizardPanel } from "../wizard";

const log = createLogger("embeds:command");

// ---------------------------------------------------------------------------
// Slash command definition
// ---------------------------------------------------------------------------

const data = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Manage custom embeds")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new embed")
      .addStringOption((o) =>
        o.setName("name").setDescription("Unique embed name").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit an existing embed")
      .addStringOption((o) => o.setName("name").setDescription("Embed name").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete an embed")
      .addStringOption((o) => o.setName("name").setDescription("Embed name").setRequired(true)),
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List all embeds in this server"))
  .addSubcommand((sub) =>
    sub
      .setName("send")
      .setDescription("Send an embed immediately")
      .addStringOption((o) => o.setName("name").setDescription("Embed name").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("preview")
      .setDescription("Preview an embed (ephemeral)")
      .addStringOption((o) => o.setName("name").setDescription("Embed name").setRequired(true)),
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

function blankDraft(): EmbedConfigDraft {
  return {
    embedTitle: null,
    embedDescription: null,
    embedColor: null,
    embedUrl: null,
    embedThumbnail: null,
    embedImage: null,
    embedAuthorName: null,
    embedAuthorIconUrl: null,
    embedAuthorUrl: null,
    embedFooterText: null,
    embedFooterIconUrl: null,
    embedFields: [],
    script: null,
    scriptEnabled: false,
    channelId: null,
    scheduleEnabled: false,
    scheduleIntervalHours: null,
    stickyEnabled: false,
  };
}

// ---------------------------------------------------------------------------
// Execute dispatcher
// ---------------------------------------------------------------------------

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({
      content: "Use this command in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const sub = interaction.options.getSubcommand();
  if (sub === "create") return handleCreate(interaction, ctx);
  if (sub === "edit") return handleEdit(interaction, ctx);
  if (sub === "delete") return handleDelete(interaction, ctx);
  if (sub === "list") return handleList(interaction, ctx);
  if (sub === "send") return handleSend(interaction, ctx);
  if (sub === "preview") return handlePreview(interaction, ctx);
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleCreate(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const raw = interaction.options.getString("name", true);
  const name = sanitizeName(raw);
  if (!name) {
    await interaction.reply({
      content: "Name must contain at least one alphanumeric character.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const existing = await getEmbedConfig(interaction.guildId!, name);
  if (existing.isErr()) {
    await interaction.reply({
      content: "Failed to check existing embeds.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (existing.unwrap() !== null) {
    await interaction.reply({
      content: `An embed named \`${name}\` already exists. Use \`/embed edit ${name}\` to edit it.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const session = embedWizardSessions.create(
    interaction.user.id,
    interaction.guildId!,
    name,
    blankDraft(),
    false,
  );
  const payload = renderWizardPanel(session);
  await interaction.reply({
    components: [payload.container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function handleEdit(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = sanitizeName(interaction.options.getString("name", true));
  const res = await getEmbedConfig(interaction.guildId!, name);
  if (res.isErr()) {
    await interaction.reply({
      content: "Failed to fetch embed config.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await interaction.reply({
      content: `No embed named \`${name}\` found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const draft: EmbedConfigDraft = {
    embedTitle: config.embedTitle,
    embedDescription: config.embedDescription,
    embedColor: config.embedColor,
    embedUrl: config.embedUrl,
    embedThumbnail: config.embedThumbnail,
    embedImage: config.embedImage,
    embedAuthorName: config.embedAuthorName,
    embedAuthorIconUrl: config.embedAuthorIconUrl,
    embedAuthorUrl: config.embedAuthorUrl,
    embedFooterText: config.embedFooterText,
    embedFooterIconUrl: config.embedFooterIconUrl,
    embedFields: [...config.embedFields],
    script: config.script,
    scriptEnabled: config.scriptEnabled,
    channelId: config.channelId,
    scheduleEnabled: config.scheduleEnabled,
    scheduleIntervalHours: config.scheduleIntervalHours,
    stickyEnabled: config.stickyEnabled,
  };
  const session = embedWizardSessions.create(
    interaction.user.id,
    interaction.guildId!,
    name,
    draft,
    true,
  );
  const payload = renderWizardPanel(session);
  await interaction.reply({
    components: [payload.container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = sanitizeName(interaction.options.getString("name", true));
  const res = await getEmbedConfig(interaction.guildId!, name);
  if (res.isErr() || !res.unwrap()) {
    await interaction.reply({
      content: `No embed named \`${name}\` found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const confirmId = `emb:direct:delete:${name}`;
  const cancelId = "emb:direct:cancel";
  const panel = container(
    "danger",
    text(
      `## Delete Embed\nAre you sure you want to delete **${name}**? This action cannot be undone.`,
    ),
    row(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel("Yes, delete")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    ),
  );
  await interaction.reply({
    components: [panel],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function handleList(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const res = await listEmbedConfigs(interaction.guildId!);
  if (res.isErr()) {
    await interaction.reply({
      content: "Failed to fetch embeds.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const configs = res.unwrap();
  if (configs.length === 0) {
    await interaction.reply({
      content: "No embeds created yet. Use `/embed create` to make one.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const children: ContainerChild[] = [text("## Your Embeds")];
  for (const cfg of configs.slice(0, 10)) {
    const channel = cfg.channelId ? `<#${cfg.channelId}>` : "No channel";
    const schedule =
      cfg.scheduleEnabled && cfg.scheduleIntervalHours ? `${cfg.scheduleIntervalHours}h` : "off";
    const sticky = cfg.stickyEnabled ? "on" : "off";
    children.push(separator("sm"));
    children.push(
      section(
        `**${cfg.name}**\nChannel: ${channel} | Schedule: ${schedule} | Sticky: ${sticky}`,
        new ButtonBuilder()
          .setCustomId(`emb:list:edit:${cfg.name}`)
          .setLabel("Edit")
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }
  await interaction.reply({
    components: [container("info", ...children)],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function handleSend(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = sanitizeName(interaction.options.getString("name", true));
  const res = await getEmbedConfig(interaction.guildId!, name);
  if (res.isErr() || !res.unwrap()) {
    await interaction.reply({
      content: `No embed named \`${name}\` found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const config = res.unwrap()!;
  if (!config.channelId) {
    await interaction.reply({
      content: "This embed has no target channel set. Edit it first.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const channel = await interaction.guild!.channels.fetch(config.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.reply({
      content: "Target channel not found or is not a text channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const sent = await sendEmbed(config, channel, interaction.guild!);
    if (config.stickyEnabled) {
      await patchEmbedConfig(config._id, {
        stickyMessageId: sent.id,
        stickyLastResendAt: new Date(),
      });
    }
    await interaction.editReply("Embed sent successfully.");
  } catch (err) {
    log.error("Failed to send embed", err);
    await interaction.editReply("Failed to send embed.");
  }
}

async function handlePreview(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = sanitizeName(interaction.options.getString("name", true));
  const res = await getEmbedConfig(interaction.guildId!, name);
  if (res.isErr() || !res.unwrap()) {
    await interaction.reply({
      content: `No embed named \`${name}\` found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await renderEmbedPreview(res.unwrap()!, interaction, interaction.guild!);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default defineCommand({ data, help: { hints: [] }, execute });

import { ButtonBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";
import { createLogger } from "@/core/logger";
import { getEmbedConfig, listEmbedConfigs, patchEmbedConfig } from "@/db/repositories/embeds";
import { command, type RunContext } from "@/framework";
import type { ContainerChild } from "@/ui/v2";
import { container, row, section, separator, text } from "@/ui/v2";
import { createBlankEmbedDraft, draftFromConfig, parseEmbedName } from "../model";
import {
  deferEphemeral,
  editDeferredEmbed,
  editDeferredText,
  replyEphemeralPanel,
  replyEphemeralText,
} from "../responses";
import { buildEmbed, sendEmbed } from "../service";
import { embedWizardSessions, renderWizardPanel } from "../wizard";

const log = createLogger("embeds:command");

// ---------------------------------------------------------------------------
// Slash command definition
// ---------------------------------------------------------------------------

const data = command("embed")
  .description("Manage custom embeds")
  .defaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .subcommand("create", "Create a new embed", (s) =>
    s.string("name", "Unique embed name", { required: true }),
  )
  .subcommand("edit", "Edit an existing embed", (s) =>
    s.string("name", "Embed name", { required: true }),
  )
  .subcommand("delete", "Delete an embed", (s) =>
    s.string("name", "Embed name", { required: true }),
  )
  .subcommand("list", "List all embeds in this server")
  .subcommand("send", "Send an embed immediately", (s) =>
    s.string("name", "Embed name", { required: true }),
  )
  .subcommand("preview", "Preview an embed (ephemeral)", (s) =>
    s.string("name", "Embed name", { required: true }),
  )
  .guildOnly();

type EmbedCtx = RunContext<typeof data>;

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleCreate(c: Extract<EmbedCtx, { subcommand: "create" }>): Promise<void> {
  const name = parseEmbedName(c.options.name);
  if (!name) {
    await replyEphemeralText(
      c.interaction,
      "Name must contain at least one alphanumeric character.",
    );
    return;
  }
  const existing = await getEmbedConfig(c.guildId, name);
  if (existing.isErr()) {
    await replyEphemeralText(c.interaction, "Failed to check existing embeds.");
    return;
  }
  if (existing.unwrap() !== null) {
    await replyEphemeralText(
      c.interaction,
      `An embed named \`${name}\` already exists. Use \`/embed edit ${name}\` to edit it.`,
    );
    return;
  }
  const session = embedWizardSessions.create(
    c.userId,
    c.guildId,
    name,
    createBlankEmbedDraft(),
    false,
  );
  const payload = renderWizardPanel(session);
  await replyEphemeralPanel(c.interaction, payload.container);
}

async function handleEdit(c: Extract<EmbedCtx, { subcommand: "edit" }>): Promise<void> {
  const name = parseEmbedName(c.options.name);
  if (!name) {
    await replyEphemeralText(
      c.interaction,
      "Name must contain at least one alphanumeric character.",
    );
    return;
  }
  const res = await getEmbedConfig(c.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(c.interaction, "Failed to fetch embed config.");
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await replyEphemeralText(c.interaction, `No embed named \`${name}\` found.`);
    return;
  }
  const session = embedWizardSessions.create(
    c.userId,
    c.guildId,
    name,
    draftFromConfig(config),
    true,
  );
  const payload = renderWizardPanel(session);
  await replyEphemeralPanel(c.interaction, payload.container);
}

async function handleDelete(c: Extract<EmbedCtx, { subcommand: "delete" }>): Promise<void> {
  const name = parseEmbedName(c.options.name);
  if (!name) {
    await replyEphemeralText(
      c.interaction,
      "Name must contain at least one alphanumeric character.",
    );
    return;
  }
  const res = await getEmbedConfig(c.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(c.interaction, "Failed to fetch embed.");
    return;
  }
  if (!res.unwrap()) {
    await replyEphemeralText(c.interaction, `No embed named \`${name}\` found.`);
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
  await replyEphemeralPanel(c.interaction, panel);
}

async function handleList(c: Extract<EmbedCtx, { subcommand: "list" }>): Promise<void> {
  const res = await listEmbedConfigs(c.guildId);
  if (res.isErr()) {
    await replyEphemeralText(c.interaction, "Failed to fetch embeds.");
    return;
  }
  const configs = res.unwrap();
  if (configs.length === 0) {
    await replyEphemeralText(
      c.interaction,
      "No embeds created yet. Use `/embed create` to make one.",
    );
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
  if (configs.length > 10) {
    children.push(separator("sm"));
    children.push(text(`_Showing 10 of ${configs.length} embeds._`));
  }
  await replyEphemeralPanel(c.interaction, container("info", ...children));
}

async function handleSend(c: Extract<EmbedCtx, { subcommand: "send" }>): Promise<void> {
  const name = parseEmbedName(c.options.name);
  if (!name) {
    await replyEphemeralText(
      c.interaction,
      "Name must contain at least one alphanumeric character.",
    );
    return;
  }
  const res = await getEmbedConfig(c.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(c.interaction, "Failed to fetch embed.");
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await replyEphemeralText(c.interaction, `No embed named \`${name}\` found.`);
    return;
  }
  if (!config.channelId) {
    await replyEphemeralText(c.interaction, "This embed has no target channel set. Edit it first.");
    return;
  }
  const channel = await c.guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    await replyEphemeralText(c.interaction, "Target channel not found or is not a text channel.");
    return;
  }
  await deferEphemeral(c.interaction);
  try {
    const sent = await sendEmbed(config, channel, c.guild);
    if (config.stickyEnabled) {
      const patchRes = await patchEmbedConfig(config._id, {
        stickyMessageId: sent.id,
        stickyLastResendAt: new Date(),
      });
      if (patchRes.isErr()) {
        log.warn("Failed to update sticky message ID after send", patchRes.error);
      }
    }
    await editDeferredText(c.interaction, "Embed sent successfully.");
  } catch (err) {
    log.error("Failed to send embed", err);
    await editDeferredText(c.interaction, "Failed to send embed.");
  }
}

async function handlePreview(c: Extract<EmbedCtx, { subcommand: "preview" }>): Promise<void> {
  const name = parseEmbedName(c.options.name);
  if (!name) {
    await replyEphemeralText(
      c.interaction,
      "Name must contain at least one alphanumeric character.",
    );
    return;
  }
  const res = await getEmbedConfig(c.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(c.interaction, "Failed to fetch embed.");
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await replyEphemeralText(c.interaction, `No embed named \`${name}\` found.`);
    return;
  }
  await deferEphemeral(c.interaction);
  try {
    const channel = c.interaction.channel ?? {
      id: c.interaction.channelId ?? "0",
      name: "channel",
    };
    const embed = await buildEmbed(
      config,
      { id: channel.id, name: "name" in channel ? (channel as { name: string }).name : "channel" },
      {
        id: c.guild.id,
        name: c.guild.name,
        memberCount: c.guild.memberCount,
      },
    );
    await editDeferredEmbed(c.interaction, embed);
  } catch (err) {
    log.error("Failed to preview embed", err);
    await editDeferredText(c.interaction, "Failed to build preview.");
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default data
  .help({ hints: [] })
  .handle("create", handleCreate)
  .handle("edit", handleEdit)
  .handle("delete", handleDelete)
  .handle("list", handleList)
  .handle("send", handleSend)
  .handle("preview", handlePreview);

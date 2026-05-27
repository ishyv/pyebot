import {
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { createLogger } from "@/core/logger";
import { getEmbedConfig, listEmbedConfigs, patchEmbedConfig } from "@/db/repositories/embeds";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
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
// Execute dispatcher
// ---------------------------------------------------------------------------

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await replyEphemeralText(interaction, "Use this command in a server.");
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
  const name = parseEmbedName(raw);
  if (!name) {
    await replyEphemeralText(interaction, "Name must contain at least one alphanumeric character.");
    return;
  }
  if (!interaction.guildId) return;
  const existing = await getEmbedConfig(interaction.guildId, name);
  if (existing.isErr()) {
    await replyEphemeralText(interaction, "Failed to check existing embeds.");
    return;
  }
  if (existing.unwrap() !== null) {
    await replyEphemeralText(
      interaction,
      `An embed named \`${name}\` already exists. Use \`/embed edit ${name}\` to edit it.`,
    );
    return;
  }
  const session = embedWizardSessions.create(
    interaction.user.id,
    interaction.guildId,
    name,
    createBlankEmbedDraft(),
    false,
  );
  const payload = renderWizardPanel(session);
  await replyEphemeralPanel(interaction, payload.container);
}

async function handleEdit(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = parseEmbedName(interaction.options.getString("name", true));
  if (!name) {
    await replyEphemeralText(interaction, "Name must contain at least one alphanumeric character.");
    return;
  }
  if (!interaction.guildId) return;
  const res = await getEmbedConfig(interaction.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(interaction, "Failed to fetch embed config.");
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await replyEphemeralText(interaction, `No embed named \`${name}\` found.`);
    return;
  }
  const session = embedWizardSessions.create(
    interaction.user.id,
    interaction.guildId,
    name,
    draftFromConfig(config),
    true,
  );
  const payload = renderWizardPanel(session);
  await replyEphemeralPanel(interaction, payload.container);
}

async function handleDelete(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = parseEmbedName(interaction.options.getString("name", true));
  if (!name) {
    await replyEphemeralText(interaction, "Name must contain at least one alphanumeric character.");
    return;
  }
  if (!interaction.guildId) return;
  const res = await getEmbedConfig(interaction.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(interaction, "Failed to fetch embed.");
    return;
  }
  if (!res.unwrap()) {
    await replyEphemeralText(interaction, `No embed named \`${name}\` found.`);
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
  await replyEphemeralPanel(interaction, panel);
}

async function handleList(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  if (!interaction.guildId) return;
  const res = await listEmbedConfigs(interaction.guildId);
  if (res.isErr()) {
    await replyEphemeralText(interaction, "Failed to fetch embeds.");
    return;
  }
  const configs = res.unwrap();
  if (configs.length === 0) {
    await replyEphemeralText(
      interaction,
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
  await replyEphemeralPanel(interaction, container("info", ...children));
}

async function handleSend(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = parseEmbedName(interaction.options.getString("name", true));
  if (!name) {
    await replyEphemeralText(interaction, "Name must contain at least one alphanumeric character.");
    return;
  }
  if (!interaction.guildId || !interaction.guild) return;
  const res = await getEmbedConfig(interaction.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(interaction, "Failed to fetch embed.");
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await replyEphemeralText(interaction, `No embed named \`${name}\` found.`);
    return;
  }
  if (!config.channelId) {
    await replyEphemeralText(interaction, "This embed has no target channel set. Edit it first.");
    return;
  }
  const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    await replyEphemeralText(interaction, "Target channel not found or is not a text channel.");
    return;
  }
  await deferEphemeral(interaction);
  try {
    const sent = await sendEmbed(config, channel, interaction.guild);
    if (config.stickyEnabled) {
      const patchRes = await patchEmbedConfig(config._id, {
        stickyMessageId: sent.id,
        stickyLastResendAt: new Date(),
      });
      if (patchRes.isErr()) {
        log.warn("Failed to update sticky message ID after send", patchRes.error);
      }
    }
    await editDeferredText(interaction, "Embed sent successfully.");
  } catch (err) {
    log.error("Failed to send embed", err);
    await editDeferredText(interaction, "Failed to send embed.");
  }
}

async function handlePreview(interaction: ChatInputCommandInteraction, _ctx: Ctx): Promise<void> {
  const name = parseEmbedName(interaction.options.getString("name", true));
  if (!name) {
    await replyEphemeralText(interaction, "Name must contain at least one alphanumeric character.");
    return;
  }
  if (!interaction.guildId || !interaction.guild) return;
  const res = await getEmbedConfig(interaction.guildId, name);
  if (res.isErr()) {
    await replyEphemeralText(interaction, "Failed to fetch embed.");
    return;
  }
  const config = res.unwrap();
  if (!config) {
    await replyEphemeralText(interaction, `No embed named \`${name}\` found.`);
    return;
  }
  await deferEphemeral(interaction);
  try {
    const channel = interaction.channel ?? { id: interaction.channelId ?? "0", name: "channel" };
    const embed = await buildEmbed(
      config,
      { id: channel.id, name: "name" in channel ? (channel as { name: string }).name : "channel" },
      {
        id: interaction.guild.id,
        name: interaction.guild.name,
        memberCount: interaction.guild.memberCount,
      },
    );
    await editDeferredEmbed(interaction, embed);
  } catch (err) {
    log.error("Failed to preview embed", err);
    await editDeferredText(interaction, "Failed to build preview.");
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default data
  .help({ hints: [] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

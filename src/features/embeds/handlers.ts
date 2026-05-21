import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  type Client,
  Events,
  type Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { createLogger } from "@/core/logger";
import {
  deleteEmbedConfig,
  embedConfigId,
  findDueScheduled,
  findStickyForChannel,
  getEmbedConfig,
  patchEmbedConfig,
  saveEmbedConfig,
} from "@/db/repositories/embeds";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { Handle, Listen } from "@/framework";
import type { BoundComponentHandler, Ctx } from "@/framework/types";
import { EMBED_MAX_FIELDS, EMBED_STICKY_DEBOUNCE_MS, SCHEDULE_SWEEP_INTERVAL_MS } from "./config";
import { buildEmbed, sendEmbed } from "./service";
import {
  type EmbedConfigDraft,
  type EmbedWizardSession,
  embedWizardSessions,
  parseWizardId,
  renderWizardPanel,
  wizardId,
} from "./wizard";

const log = createLogger("embeds:handler");

export default class EmbedHandlers {
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  // channelId → config._id (null = confirmed no sticky for this channel)
  private readonly stickyCache = new Map<string, string | null>();

  @Listen(Events.ClientReady)
  onReady(client: Client, _ctx: Ctx): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(
      () =>
        void this.runScheduledSweep(client).catch((err) => log.error("Schedule sweep error", err)),
      SCHEDULE_SWEEP_INTERVAL_MS,
    );
  }

  @Listen("messageCreate")
  async onMessage(message: Message, _ctx: Ctx): Promise<void> {
    try {
      if (message.author.bot || !message.guildId || !message.guild) return;

      // Check cache first (avoid DB hit on every message)
      let configId: string | null | undefined = this.stickyCache.get(message.channelId);
      if (configId === undefined) {
        // Not cached — look up
        const res = await findStickyForChannel(message.guildId, message.channelId);
        if (res.isErr()) return;
        const found = res.unwrap();
        configId = found?._id ?? null;
        this.stickyCache.set(message.channelId, configId);
      }
      if (configId === null) return; // No sticky configured for this channel

      // Extract name from _id (format: "{guildId}:{name}"); names can't contain colons
      const colonIdx = configId.indexOf(":");
      const name = configId.slice(colonIdx + 1);

      // Fetch the config
      const cfgRes = await getEmbedConfig(message.guildId, name);
      if (cfgRes.isErr()) {
        this.stickyCache.delete(message.channelId);
        return;
      }
      const config = cfgRes.unwrap();
      if (!config) {
        this.stickyCache.delete(message.channelId);
        return;
      }

      // Debounce check
      if (
        config.stickyLastResendAt &&
        Date.now() - config.stickyLastResendAt.getTime() < EMBED_STICKY_DEBOUNCE_MS
      ) {
        return;
      }

      // Delete old sticky message
      if (config.stickyMessageId) {
        await message.channel.messages.delete(config.stickyMessageId).catch(() => null);
      }

      // Re-send and update stored message ID
      const sent = await sendEmbed(config, message.channel, message.guild);
      const patchRes = await patchEmbedConfig(config._id, {
        stickyMessageId: sent.id,
        stickyLastResendAt: new Date(),
      });
      if (patchRes.isErr()) {
        log.warn("Failed to update sticky state", patchRes.error);
      }
    } catch (err) {
      log.error("Sticky handler error", err);
    }
  }

  @Handle("emb:")
  async onWizardInteraction(
    interaction: Parameters<BoundComponentHandler>[0],
    ctx: Ctx,
  ): Promise<void> {
    const customId =
      interaction instanceof ModalSubmitInteraction ||
      interaction instanceof ButtonInteraction ||
      interaction instanceof StringSelectMenuInteraction ||
      interaction instanceof ChannelSelectMenuInteraction
        ? interaction.customId
        : null;

    if (!customId) return;

    const parsed = parseWizardId(customId);
    if (!parsed) return;

    // Handle special "direct" (no-session) interactions
    if (parsed.sessionId === "direct") {
      await this.handleDirectAction(interaction, parsed.action);
      return;
    }

    // Handle "list" interactions — open edit wizard from list view
    if (parsed.sessionId === "list") {
      if (interaction instanceof ButtonInteraction) {
        await this.handleListAction(interaction, parsed.action, ctx);
      }
      return;
    }

    // Session-based wizard interactions
    const session = embedWizardSessions.get(parsed.sessionId);
    if (!session) {
      if ("reply" in interaction && typeof interaction.reply === "function") {
        await (
          interaction as {
            reply: (opts: { content: string; flags: number }) => Promise<unknown>;
          }
        ).reply({
          content: "Wizard session expired. Run `/embed` again.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }
    if (session.ownerId !== interaction.user.id) {
      if ("reply" in interaction && typeof interaction.reply === "function") {
        await (
          interaction as {
            reply: (opts: { content: string; flags: number }) => Promise<unknown>;
          }
        ).reply({ content: "This wizard belongs to another user.", flags: MessageFlags.Ephemeral });
      }
      return;
    }

    await this.handleWizardAction(interaction, session, parsed.action, ctx);
  }

  // ─── Private: direct (no-session) actions ────────────────────────────────

  private async handleDirectAction(
    interaction: Parameters<BoundComponentHandler>[0],
    action: string,
  ): Promise<void> {
    if (!("guildId" in interaction) || !interaction.guildId) return;

    if (action.startsWith("delete:")) {
      const name = action.slice(7);
      const id = embedConfigId(interaction.guildId, name);
      // Fetch config before deleting so we know which channel to evict from the sticky cache
      const cfgRes = await getEmbedConfig(interaction.guildId, name);
      const channelId = cfgRes.isOk() ? (cfgRes.unwrap()?.channelId ?? null) : null;
      const deleteRes = await deleteEmbedConfig(id);
      if (channelId) this.invalidateStickyCache(channelId);
      if ("update" in interaction && typeof interaction.update === "function") {
        await (
          interaction as {
            update: (opts: { content: string; components: unknown[] }) => Promise<unknown>;
          }
        ).update({
          content: deleteRes.isErr() ? "Failed to delete embed." : `Embed \`${name}\` deleted.`,
          components: [],
        });
      }
      return;
    }
    if (action === "cancel") {
      if ("update" in interaction && typeof interaction.update === "function") {
        await (
          interaction as {
            update: (opts: { content: string; components: unknown[] }) => Promise<unknown>;
          }
        ).update({ content: "Cancelled.", components: [] });
      }
      return;
    }
  }

  // ─── Private: list-button action (open edit wizard) ──────────────────────

  private async handleListAction(
    interaction: ButtonInteraction,
    action: string,
    _ctx: Ctx,
  ): Promise<void> {
    if (!interaction.guildId) return;
    if (!action.startsWith("edit:")) return;
    const name = action.slice(5);

    const res = await getEmbedConfig(interaction.guildId, name);
    const config = res.isOk() ? res.unwrap() : null;
    if (!config) {
      await interaction.reply({
        content: `Embed \`${name}\` not found.`,
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
      interaction.guildId,
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

  // ─── Private: wizard action dispatch ─────────────────────────────────────

  private async handleWizardAction(
    interaction: Parameters<BoundComponentHandler>[0],
    session: EmbedWizardSession,
    action: string,
    _ctx: Ctx,
  ): Promise<void> {
    // ── Modal launchers (buttons that open modals) ──
    if (interaction instanceof ButtonInteraction) {
      if (action === "basic-modal") {
        await interaction.showModal(this.buildBasicModal(session.id, session.draft));
        return;
      }
      if (action === "media-modal") {
        await interaction.showModal(this.buildMediaModal(session.id, session.draft));
        return;
      }
      if (action === "author-modal") {
        await interaction.showModal(this.buildAuthorModal(session.id, session.draft));
        return;
      }
      if (action === "footer-modal") {
        await interaction.showModal(this.buildFooterModal(session.id, session.draft));
        return;
      }
      if (action === "field-add-modal") {
        await interaction.showModal(this.buildFieldAddModal(session.id));
        return;
      }
      if (action === "script-modal") {
        await interaction.showModal(this.buildScriptModal(session.id, session.draft));
        return;
      }
      if (action === "sticky-toggle") {
        session.draft.stickyEnabled = !session.draft.stickyEnabled;
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "script-toggle") {
        session.draft.scriptEnabled = !session.draft.scriptEnabled;
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "field-remove-last") {
        session.draft.embedFields = session.draft.embedFields.slice(0, -1);
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "preview") {
        if (!interaction.guildId || !interaction.guild) return;
        const draftConfig = this.draftToConfig(session);
        const channel = interaction.channel ?? {
          id: interaction.channelId ?? "0",
          name: "channel",
        };
        const channelCtx = {
          id: channel.id,
          name: "name" in channel ? (channel as { name: string }).name : "channel",
        };
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const embed = await buildEmbed(draftConfig, channelCtx, {
            id: interaction.guild.id,
            name: interaction.guild.name,
            memberCount: interaction.guild.memberCount,
          });
          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          log.error("Preview failed", err);
          await interaction.editReply("Failed to build preview.");
        }
        return;
      }
      if (action === "save") {
        await this.handleSave(interaction, session);
        return;
      }
      if (action === "cancel") {
        embedWizardSessions.delete(session.id);
        await interaction.update({ content: "Cancelled.", components: [] });
        return;
      }
    }

    // ── Modal submits ──
    if (interaction instanceof ModalSubmitInteraction) {
      if (action === "basic-submit") {
        const title = interaction.fields.getTextInputValue("title").trim() || null;
        const desc = interaction.fields.getTextInputValue("description").trim() || null;
        const colorRaw = interaction.fields.getTextInputValue("color").trim();
        if (colorRaw) {
          const colorVal = parseInt(colorRaw.replace("#", ""), 16);
          if (!Number.isNaN(colorVal) && colorVal >= 0 && colorVal <= 0xffffff) {
            session.draft.embedColor = colorVal;
          }
        }
        session.draft.embedTitle = title;
        session.draft.embedDescription = desc;
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "media-submit") {
        session.draft.embedThumbnail = this.parseUrl(
          interaction.fields.getTextInputValue("thumbnail"),
        );
        session.draft.embedImage = this.parseUrl(interaction.fields.getTextInputValue("image"));
        session.draft.embedUrl = this.parseUrl(interaction.fields.getTextInputValue("url"));
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "author-submit") {
        session.draft.embedAuthorName = interaction.fields.getTextInputValue("name").trim() || null;
        session.draft.embedAuthorIconUrl = this.parseUrl(
          interaction.fields.getTextInputValue("iconUrl"),
        );
        session.draft.embedAuthorUrl = this.parseUrl(interaction.fields.getTextInputValue("url"));
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "footer-submit") {
        session.draft.embedFooterText = interaction.fields.getTextInputValue("text").trim() || null;
        session.draft.embedFooterIconUrl = this.parseUrl(
          interaction.fields.getTextInputValue("iconUrl"),
        );
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "field-add-submit") {
        const name = interaction.fields.getTextInputValue("name").trim();
        const value = interaction.fields.getTextInputValue("value").trim();
        const inlineRaw = interaction.fields.getTextInputValue("inline").trim().toLowerCase();
        if (name && value && session.draft.embedFields.length < EMBED_MAX_FIELDS) {
          session.draft.embedFields = [
            ...session.draft.embedFields,
            { name, value, inline: inlineRaw === "yes" || inlineRaw === "true" },
          ];
        }
        await this.updateWizardPanel(interaction, session);
        return;
      }
      if (action === "script-submit") {
        session.draft.script = interaction.fields.getTextInputValue("script").trim() || null;
        await this.updateWizardPanel(interaction, session);
        return;
      }
    }

    // ── Select menus ──
    if (interaction instanceof ChannelSelectMenuInteraction) {
      if (action === "channel-select") {
        session.draft.channelId = interaction.values[0] ?? null;
        await this.updateWizardPanel(interaction, session);
        return;
      }
    }
    if (interaction instanceof StringSelectMenuInteraction) {
      if (action === "schedule-select") {
        const val = interaction.values[0];
        if (val === "off") {
          session.draft.scheduleEnabled = false;
          session.draft.scheduleIntervalHours = null;
        } else {
          const hours = parseInt(val, 10) as 1 | 6 | 12 | 24 | 168;
          session.draft.scheduleEnabled = true;
          session.draft.scheduleIntervalHours = hours;
        }
        await this.updateWizardPanel(interaction, session);
        return;
      }
    }
  }

  // ─── Private: save wizard ─────────────────────────────────────────────────

  private async handleSave(
    interaction: ButtonInteraction,
    session: EmbedWizardSession,
  ): Promise<void> {
    if (!interaction.guildId) return;

    if (!session.draft.channelId) {
      await interaction.reply({
        content: "Set a target channel before saving.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // One-sticky-per-channel check
    if (session.draft.stickyEnabled) {
      const existingRes = await findStickyForChannel(interaction.guildId, session.draft.channelId);
      if (existingRes.isErr()) {
        await interaction.reply({
          content: "Could not verify sticky status. Please try again.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const existing = existingRes.unwrap();
      if (existing && existing._id !== embedConfigId(interaction.guildId, session.embedName)) {
        await interaction.reply({
          content: "Another embed is already sticky in that channel. Disable it first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const now = new Date();
    let preservedCreatedAt: Date = now;
    let preservedStickyMessageId: string | null = null;
    let preservedStickyLastResendAt: Date | null = null;

    if (session.isEdit) {
      const prevRes = await getEmbedConfig(interaction.guildId, session.embedName);
      if (prevRes.isOk()) {
        const prev = prevRes.unwrap();
        if (prev) {
          preservedCreatedAt = prev.createdAt;
          // Carry sticky state forward only when the channel hasn't changed
          if (prev.channelId === session.draft.channelId) {
            preservedStickyMessageId = prev.stickyMessageId;
            preservedStickyLastResendAt = prev.stickyLastResendAt;
          }
        }
      }
    }

    const config: EmbedConfig = {
      _id: embedConfigId(interaction.guildId, session.embedName),
      guildId: interaction.guildId,
      name: session.embedName,
      createdBy: session.ownerId,
      ...session.draft,
      stickyMessageId: preservedStickyMessageId,
      stickyLastResendAt: preservedStickyLastResendAt,
      scheduledNextSendAt:
        session.draft.scheduleEnabled && session.draft.scheduleIntervalHours
          ? new Date(now.getTime() + session.draft.scheduleIntervalHours * 3_600_000)
          : null,
      scheduledLastSentAt: null,
      createdAt: preservedCreatedAt,
      updatedAt: now,
    };

    const saveRes = await saveEmbedConfig(config);
    if (saveRes.isErr()) {
      await interaction.reply({ content: "Failed to save embed.", flags: MessageFlags.Ephemeral });
      return;
    }

    this.invalidateStickyCache(session.draft.channelId);
    embedWizardSessions.delete(session.id);

    await interaction.update({ content: `Embed \`${session.embedName}\` saved.`, components: [] });
  }

  // ─── Private: schedule sweep ──────────────────────────────────────────────

  private async runScheduledSweep(client: Client): Promise<void> {
    const res = await findDueScheduled();
    if (res.isErr()) {
      log.error("Failed to fetch due scheduled embeds", res.error);
      return;
    }
    for (const config of res.unwrap()) {
      try {
        const guild = await client.guilds.fetch(config.guildId).catch(() => null);
        if (!guild) continue;
        if (!config.channelId) continue;
        const channel = await guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel?.isTextBased()) continue;

        const sent = await sendEmbed(config, channel, guild);
        const nextSendAt = new Date(Date.now() + (config.scheduleIntervalHours ?? 24) * 3_600_000);
        const patchData: Partial<EmbedConfig> = {
          scheduledNextSendAt: nextSendAt,
          scheduledLastSentAt: new Date(),
        };
        if (config.stickyEnabled) {
          patchData.stickyMessageId = sent.id;
        }
        const patchRes = await patchEmbedConfig(config._id, patchData);
        if (patchRes.isErr()) {
          log.warn("Failed to update schedule state for embed", { id: config._id });
        }
      } catch (err) {
        log.error("Sweep error for embed", { id: config._id, err });
      }
    }
  }

  // ─── Private: update wizard panel after interaction ───────────────────────

  private async updateWizardPanel(
    interaction:
      | ButtonInteraction
      | StringSelectMenuInteraction
      | ChannelSelectMenuInteraction
      | ModalSubmitInteraction,
    session: EmbedWizardSession,
  ): Promise<void> {
    const payload = renderWizardPanel(session);
    // biome-ignore lint/suspicious/noExplicitAny: ContainerBuilder is valid at runtime but not yet reflected in discord.js InteractionUpdateOptions/MessageEditOptions types.
    const options: any = { components: [payload.container], flags: MessageFlags.IsComponentsV2 };
    if (interaction instanceof ModalSubmitInteraction) {
      await interaction.deferUpdate();
      await interaction.message?.edit(options);
    } else {
      await interaction.update(options);
    }
  }

  // ─── Private: modal builders ──────────────────────────────────────────────

  private buildBasicModal(sessionId: string, draft: EmbedConfigDraft): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(wizardId(sessionId, "basic-submit"))
      .setTitle("Basic Settings")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("title")
            .setLabel("Title")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(false)
            .setValue(draft.embedTitle ?? ""),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("description")
            .setLabel("Description")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setRequired(false)
            .setValue(draft.embedDescription ?? ""),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("color")
            .setLabel("Color (hex, e.g. #5865F2)")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(7)
            .setRequired(false)
            .setValue(draft.embedColor ? `#${draft.embedColor.toString(16).padStart(6, "0")}` : ""),
        ),
      );
  }

  private buildMediaModal(sessionId: string, draft: EmbedConfigDraft): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(wizardId(sessionId, "media-submit"))
      .setTitle("Media")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("thumbnail")
            .setLabel("Thumbnail URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(draft.embedThumbnail ?? ""),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("image")
            .setLabel("Image URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(draft.embedImage ?? ""),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("url")
            .setLabel("Embed URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(draft.embedUrl ?? ""),
        ),
      );
  }

  private buildAuthorModal(sessionId: string, draft: EmbedConfigDraft): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(wizardId(sessionId, "author-submit"))
      .setTitle("Author")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Author Name")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(false)
            .setValue(draft.embedAuthorName ?? ""),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("iconUrl")
            .setLabel("Author Icon URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(draft.embedAuthorIconUrl ?? ""),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("url")
            .setLabel("Author URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(draft.embedAuthorUrl ?? ""),
        ),
      );
  }

  private buildFooterModal(sessionId: string, draft: EmbedConfigDraft): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(wizardId(sessionId, "footer-submit"))
      .setTitle("Footer")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("text")
            .setLabel("Footer Text")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(2048)
            .setRequired(false)
            .setValue(draft.embedFooterText ?? ""),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("iconUrl")
            .setLabel("Footer Icon URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(draft.embedFooterIconUrl ?? ""),
        ),
      );
  }

  private buildFieldAddModal(sessionId: string): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(wizardId(sessionId, "field-add-submit"))
      .setTitle("Add Field")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Field Name")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Field Value")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1024)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("inline")
            .setLabel("Inline? (yes/no)")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(3)
            .setRequired(false),
        ),
      );
  }

  private buildScriptModal(sessionId: string, draft: EmbedConfigDraft): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(wizardId(sessionId, "script-submit"))
      .setTitle("Script")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("script")
            .setLabel("JS function, e.g. (ctx) => ({ title: ctx.guild.name })")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setRequired(false)
            .setValue(draft.script ?? ""),
        ),
      );
  }

  // ─── Private: helpers ─────────────────────────────────────────────────────

  private parseUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }

  private draftToConfig(session: EmbedWizardSession): EmbedConfig {
    const now = new Date();
    return {
      _id: embedConfigId(session.guildId, session.embedName),
      guildId: session.guildId,
      name: session.embedName,
      createdBy: session.ownerId,
      ...session.draft,
      stickyMessageId: null,
      stickyLastResendAt: null,
      scheduledNextSendAt: null,
      scheduledLastSentAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private invalidateStickyCache(channelId: string): void {
    this.stickyCache.delete(channelId);
  }
}

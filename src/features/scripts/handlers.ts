import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type Client,
  Events,
  type GuildMember,
  MessageFlags,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { SCRIPT_CAPABILITIES, ScriptDefinition, scriptId } from "@/components/script-definition";
import { sessions } from "@/core/state";
import { Handle, Listen } from "@/framework";
import type { BoundComponentHandler, Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { parseCapabilities } from "./model";
import { resolveRunnable } from "./resolve";
import { executeRunnable, type Runnable } from "./run";
import { runEventScripts } from "./triggers/events";
import { runScheduleSweep } from "./triggers/schedule";

interface ScriptInputSession {
  readonly runnable: Runnable;
  readonly input?: Record<string, string>;
}

function sessionKey(userId: string, guildId: string, name: string): string {
  return `scr:${userId}:${guildId}:${name}`;
}

function inputSessionKey(
  interaction: { user: { id: string }; guildId: string | null },
  name: string,
): string {
  return sessionKey(interaction.user.id, interaction.guildId ?? "", name);
}

const SCHEDULE_SWEEP_INTERVAL_MS = 60_000;

function isManageGuild(interaction: {
  memberPermissions: ButtonInteraction["memberPermissions"];
}): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

async function replyEphemeral(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  accent: Parameters<typeof container>[0],
  body: string,
): Promise<void> {
  const payload = v2Message(container(accent, text(body)));
  await interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
}

/**
 * Routes `scr:` component interactions: the script editor modal and the
 * confirm/cancel buttons. Mutating buttons re-check ManageGuild because a button
 * press is a fresh interaction that does not pass through the command's gate.
 */
export default class ScriptHandlers {
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  @Listen(Events.ClientReady)
  onReady(client: Client, ctx: Ctx): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(
      () =>
        void runScheduleSweep(client, ctx).catch((err) =>
          ctx.logger.error("Script schedule sweep failed", err),
        ),
      SCHEDULE_SWEEP_INTERVAL_MS,
    );
  }

  @Listen(Events.GuildMemberAdd)
  async onMemberJoin(member: GuildMember, ctx: Ctx): Promise<void> {
    await runEventScripts(member.client, ctx, "member-join", member.guild.id, {
      id: member.id,
      tag: member.user.tag,
    });
  }

  @Handle("scr:")
  async onInteraction(interaction: Parameters<BoundComponentHandler>[0], ctx: Ctx): Promise<void> {
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (id.startsWith("scr:inp:")) {
        await this.onInputSubmit(interaction, ctx, id.slice("scr:inp:".length));
      } else {
        await this.onModalSubmit(interaction, ctx);
      }
      return;
    }
    if (!interaction.isButton()) return;

    const id = interaction.customId;
    if (id === "scr:cancel") {
      await interaction.update(v2Message(container("mute", text("Cancelled."))));
      return;
    }
    if (id.startsWith("scr:apply:")) {
      await this.onConfirmApply(interaction, ctx, id.slice("scr:apply:".length));
      return;
    }
    if (id.startsWith("scr:run:")) {
      await this.onConfirmRun(interaction, ctx, id.slice("scr:run:".length));
      return;
    }
    if (id.startsWith("scr:delete:")) {
      await this.onConfirmDelete(interaction, ctx, id.slice("scr:delete:".length));
    }
  }

  private async onModalSubmit(interaction: ModalSubmitInteraction, ctx: Ctx): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const name = interaction.customId.slice("scr:modal:".length);

    const source = interaction.fields.getTextInputValue("source").trim();
    const description = interaction.fields.getTextInputValue("description").trim();
    const caps = parseCapabilities(interaction.fields.getTextInputValue("capabilities"));

    if (!caps.ok) {
      await replyEphemeral(
        interaction,
        "danger",
        `Unknown capabilities: ${caps.invalid.join(", ")}. Valid: ${SCRIPT_CAPABILITIES.join(", ")}.`,
      );
      return;
    }
    if (!source) {
      await replyEphemeral(interaction, "danger", "Source cannot be empty.");
      return;
    }

    const id = scriptId(guildId, name);
    const existing = await ctx.get(id, ScriptDefinition);
    const now = new Date();
    if (existing) {
      await ctx.patch(id, ScriptDefinition, {
        source,
        description,
        capabilities: caps.value,
        updatedAt: now,
      });
    } else {
      await ctx.set(id, ScriptDefinition, {
        guildId,
        name,
        description,
        source,
        capabilities: caps.value,
        trigger: { kind: "manual" },
        reportChannelId: null,
        scheduleNextRunAt: null,
        createdBy: interaction.user.id,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    await replyEphemeral(
      interaction,
      "ok",
      `Saved \`${name}\`. Run it with \`/script run ${name}\`.`,
    );
  }

  private async onConfirmRun(
    interaction: ButtonInteraction,
    ctx: Ctx,
    name: string,
  ): Promise<void> {
    if (!isManageGuild(interaction)) {
      await replyEphemeral(interaction, "danger", "You need Manage Server to run scripts.");
      return;
    }
    const guild = interaction.guild;
    if (!guild) return;

    const runnable = await resolveRunnable(ctx, guild.id, name);
    if (!runnable) {
      await interaction.update(
        v2Message(container("danger", text(`No script named \`${name}\`.`))),
      );
      return;
    }

    await interaction.deferUpdate();
    const presented = await executeRunnable(guild, runnable, {
      dryRun: false,
      invoker: { id: interaction.user.id, tag: interaction.user.tag },
      channel: interaction.channelId ? { id: interaction.channelId, name: "channel" } : null,
    });
    await interaction.editReply(v2Message(presented.container));
  }

  private async onConfirmDelete(
    interaction: ButtonInteraction,
    ctx: Ctx,
    name: string,
  ): Promise<void> {
    if (!isManageGuild(interaction)) {
      await replyEphemeral(interaction, "danger", "You need Manage Server to delete scripts.");
      return;
    }
    const guildId = interaction.guildId;
    if (!guildId) return;

    await ctx.delete(scriptId(guildId, name), ScriptDefinition);
    await interaction.update(v2Message(container("ok", text(`Deleted \`${name}\`.`))));
  }

  /**
   * Handles submission of the input form modal (`scr:inp:{name}`).
   * Retrieves the stored runnable, populates ctx.input, dry-runs, and shows
   * the result — with an Apply button if there are operations.
   */
  private async onInputSubmit(
    interaction: ModalSubmitInteraction,
    _ctx: Ctx,
    name: string,
  ): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const key = inputSessionKey(interaction, name);
    const session = sessions.get(key) as ScriptInputSession | undefined;
    if (!session) {
      await interaction.reply({
        ...v2Message(container("danger", text("Input form expired. Use `/script run` again."))),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Collect input values from modal fields (keyed by their customId = input name)
    const collected: Record<string, string> = {};
    for (const [customId] of interaction.fields.fields) {
      collected[customId] = interaction.fields.getTextInputValue(customId).trim();
    }

    // Store with collected inputs for the Apply button
    sessions.set(key, { ...session, input: collected });

    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const presented = await executeRunnable(guild, session.runnable, {
      dryRun: true,
      invoker: { id: interaction.user.id, tag: interaction.user.tag },
      channel: interaction.channelId ? { id: interaction.channelId, name: "channel" } : null,
      input: collected,
    });

    if (presented.operationCount === 0) {
      await interaction.editReply(v2Message(presented.container));
    } else {
      const applyBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`scr:apply:${name}`)
          .setLabel("Apply")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("scr:cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      );
      await interaction.editReply(v2Message(presented.container, applyBtn));
    }
  }

  /**
   * Handles the Apply button for scripts that collected inputs (`scr:apply:{name}`).
   * Retrieves the stored inputs from the session and runs the script for real.
   */
  private async onConfirmApply(
    interaction: ButtonInteraction,
    _ctx: Ctx,
    name: string,
  ): Promise<void> {
    if (!isManageGuild(interaction)) {
      await replyEphemeral(interaction, "danger", "You need Manage Server to run scripts.");
      return;
    }
    const guild = interaction.guild;
    if (!guild) return;

    const key = inputSessionKey(interaction, name);
    const session = sessions.get(key) as ScriptInputSession | undefined;
    if (!session) {
      await interaction.update(
        v2Message(container("danger", text("Session expired. Use `/script run` again."))),
      );
      return;
    }

    await interaction.deferUpdate();
    const presented = await executeRunnable(guild, session.runnable, {
      dryRun: false,
      invoker: { id: interaction.user.id, tag: interaction.user.tag },
      channel: interaction.channelId ? { id: interaction.channelId, name: "channel" } : null,
      input: session.input ?? {},
    });
    sessions.delete(key);
    await interaction.editReply(v2Message(presented.container));
  }
}

import {
  type ButtonInteraction,
  type Client,
  Events,
  type GuildMember,
  MessageFlags,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { SCRIPT_CAPABILITIES, ScriptDefinition, scriptId } from "@/components/script-definition";
import { Handle, Listen } from "@/framework";
import type { BoundComponentHandler, Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { parseCapabilities } from "./model";
import { resolveRunnable } from "./resolve";
import { executeRunnable } from "./run";
import { runEventScripts } from "./triggers/events";
import { runScheduleSweep } from "./triggers/schedule";

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
      await this.onModalSubmit(interaction, ctx);
      return;
    }
    if (!interaction.isButton()) return;

    const id = interaction.customId;
    if (id === "scr:cancel") {
      await interaction.update(v2Message(container("mute", text("Cancelled."))));
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
}

import {
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type Client,
  Events,
  type GuildMember,
  MessageFlags,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  type RoleSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from "discord.js";
import { SCRIPT_CAPABILITIES, ScriptDefinition, scriptId } from "@/components/script-definition";
import { sessions } from "@/core/state";
import { Handle, Listen } from "@/framework";
import type { BoundComponentHandler, Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { validateInputValues } from "./engine";
import {
  applyRow,
  backRow,
  buildInputModal,
  renderCollector,
  type ScriptInputSession,
  sessionKey,
} from "./input-collector";
import { parseCapabilities } from "./model";
import { saveExistingScript } from "./persistence";
import { resolveRunnable } from "./resolve";
import { executeRunnable } from "./run";
import { runEventScripts } from "./triggers/events";
import { runScheduleSweep } from "./triggers/schedule";

type EntitySelectInteraction =
  | RoleSelectMenuInteraction
  | UserSelectMenuInteraction
  | ChannelSelectMenuInteraction;

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

function getSession(
  interaction: { user: { id: string }; guildId: string | null },
  name: string,
): ScriptInputSession | undefined {
  return sessions.get(sessionKey(interaction.user.id, interaction.guildId ?? "", name)) as
    | ScriptInputSession
    | undefined;
}

/**
 * Routes `scr:` component interactions: the script editor modal, the input
 * collector (select menus + modal + Run), and the confirm/cancel/delete buttons.
 * Mutating buttons re-check ManageGuild because a button press is a fresh
 * interaction that does not pass through the command's gate.
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
    const id = interaction.customId;

    if (interaction.isModalSubmit()) {
      if (id.startsWith("scr:inp:")) {
        await this.onInputSubmit(interaction, id.slice("scr:inp:".length));
      } else {
        await this.onModalSubmit(interaction, ctx);
      }
      return;
    }

    if (
      (interaction.isRoleSelectMenu() ||
        interaction.isUserSelectMenu() ||
        interaction.isChannelSelectMenu()) &&
      id.startsWith("scr:sel:")
    ) {
      await this.onInputSelect(interaction, id.slice("scr:sel:".length));
      return;
    }

    if (!interaction.isButton()) return;

    if (id === "scr:cancel") {
      await interaction.update(v2Message(container("mute", text("Cancelled."))));
      return;
    }
    if (id.startsWith("scr:txt:")) {
      await this.onTextFields(interaction, id.slice("scr:txt:".length));
      return;
    }
    if (id.startsWith("scr:go:")) {
      await this.onCollectorRun(interaction, id.slice("scr:go:".length));
      return;
    }
    if (id.startsWith("scr:back:")) {
      await this.onBackToInputs(interaction, id.slice("scr:back:".length));
      return;
    }
    if (id.startsWith("scr:apply:")) {
      await this.onConfirmApply(interaction, id.slice("scr:apply:".length));
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

  /** Return from a successful run result to the same collector state. */
  private async onBackToInputs(interaction: ButtonInteraction, name: string): Promise<void> {
    const session = getSession(interaction, name);
    if (!session) {
      await interaction.update(
        v2Message(container("danger", text("This form expired. Use `/script run` again."))),
      );
      return;
    }

    await interaction.update(renderCollector(name, session.fields, session.values));
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
      await saveExistingScript(ctx, id, existing, {
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

  // ─── Input collector ────────────────────────────────────────────────────────

  /** An entity select changed — store its value and re-render the collector. */
  private async onInputSelect(interaction: EntitySelectInteraction, rest: string): Promise<void> {
    const colon = rest.indexOf(":");
    const name = rest.slice(0, colon);
    const inputName = rest.slice(colon + 1);

    const session = getSession(interaction, name);
    if (!session) {
      await interaction.update(
        v2Message(container("danger", text("This form expired. Use `/script run` again."))),
      );
      return;
    }

    session.values[inputName] = interaction.values[0] ?? "";
    sessions.set(sessionKey(interaction.user.id, interaction.guildId ?? "", name), session);
    await interaction.update(renderCollector(name, session.fields, session.values));
  }

  /** "Fill text fields" — open the text/number modal prefilled with current values. */
  private async onTextFields(interaction: ButtonInteraction, name: string): Promise<void> {
    const session = getSession(interaction, name);
    if (!session) {
      await interaction.update(
        v2Message(container("danger", text("This form expired. Use `/script run` again."))),
      );
      return;
    }
    await interaction.showModal(buildInputModal(name, session.fields, session.values));
  }

  /** Text/number modal submitted — store values, flag bad numbers, re-render collector. */
  private async onInputSubmit(interaction: ModalSubmitInteraction, name: string): Promise<void> {
    if (!interaction.isFromMessage()) return;
    const session = getSession(interaction, name);
    if (!session) {
      await interaction.update(
        v2Message(container("danger", text("This form expired. Use `/script run` again."))),
      );
      return;
    }

    for (const [customId] of interaction.fields.fields) {
      session.values[customId] = interaction.fields.getTextInputValue(customId).trim();
    }

    let badNumber: string | undefined;
    for (const f of session.fields) {
      if (f.type === "number") {
        const v = session.values[f.name];
        if (v && Number.isNaN(Number(v))) {
          badNumber = `**${f.label}** must be a number.`;
          break;
        }
      }
    }

    sessions.set(sessionKey(interaction.user.id, interaction.guildId ?? "", name), session);
    await interaction.update(
      renderCollector(
        name,
        session.fields,
        session.values,
        badNumber ? { message: badNumber, soft: true } : undefined,
      ),
    );
  }

  /** "Run" — validate, dry-run with the collected inputs, then show the result. */
  private async onCollectorRun(interaction: ButtonInteraction, name: string): Promise<void> {
    if (!isManageGuild(interaction)) {
      await replyEphemeral(interaction, "danger", "You need Manage Server to run scripts.");
      return;
    }
    const guild = interaction.guild;
    if (!guild) return;

    const session = getSession(interaction, name);
    if (!session) {
      await interaction.update(
        v2Message(container("danger", text("This form expired. Use `/script run` again."))),
      );
      return;
    }

    const validationError = validateInputValues(session.fields, session.values);
    if (validationError) {
      await interaction.update(
        renderCollector(name, session.fields, session.values, {
          message: validationError,
          soft: true,
        }),
      );
      return;
    }

    await interaction.deferUpdate();
    const presented = await executeRunnable(guild, session.runnable, {
      dryRun: true,
      invoker: { id: interaction.user.id, tag: interaction.user.tag },
      channel: interaction.channelId ? { id: interaction.channelId, name: "channel" } : null,
      input: session.values,
    });

    if (presented.error) {
      await interaction.editReply(
        renderCollector(name, session.fields, session.values, {
          message: presented.error,
          soft: presented.inputError ?? false,
        }),
      );
      return;
    }

    if (presented.operationCount === 0) {
      await interaction.editReply(v2Message(presented.container, backRow(name)));
    } else {
      await interaction.editReply(v2Message(presented.container, applyRow(name)));
    }
  }

  /** Apply button after a collector dry-run — run for real with the stored inputs. */
  private async onConfirmApply(interaction: ButtonInteraction, name: string): Promise<void> {
    if (!isManageGuild(interaction)) {
      await replyEphemeral(interaction, "danger", "You need Manage Server to run scripts.");
      return;
    }
    const guild = interaction.guild;
    if (!guild) return;

    const session = getSession(interaction, name);
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
      input: session.values,
    });
    await interaction.editReply(v2Message(presented.container, backRow(name)));
  }

  // ─── No-input confirm/delete (unchanged) ─────────────────────────────────────

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

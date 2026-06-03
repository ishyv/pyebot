import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  ScriptDefinition,
  type ScriptDefinitionValue,
  scriptId,
} from "@/components/script-definition";
import { command, type RunContext } from "@/framework";
import { type ContainerChild, container, separator, text, type V2Top, v2Message } from "@/ui/v2";
import { LIBRARY_SCRIPTS } from "../library";
import { describeTrigger, parseScriptName } from "../model";
import { resolveRunnable } from "../resolve";
import { executeRunnable } from "../run";

const data = command("script")
  .description("Author and run server scripts")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .subcommand("create", "Create a new script", (s) =>
    s.string("name", "Unique script name", { required: true }),
  )
  .subcommand("edit", "Edit an existing script", (s) =>
    s.string("name", "Script name", { required: true }),
  )
  .subcommand("run", "Run a script (previews the plan first)", (s) =>
    s.string("name", "Script name", { required: true }),
  )
  .subcommand("list", "List this server's scripts")
  .subcommand("delete", "Delete a script", (s) =>
    s.string("name", "Script name", { required: true }),
  )
  .subcommand("schedule", "Run a script on a recurring interval", (s) =>
    s
      .string("name", "Script name", { required: true })
      .integer("hours", "Interval in hours", { required: true, min: 1, max: 168 })
      .channel("channel", "Channel to post run summaries in"),
  )
  .subcommand("manual", "Clear a script's trigger (run only via /script run)", (s) =>
    s.string("name", "Script name", { required: true }),
  )
  .adminOnly()
  .guildOnly();

type ScriptCtx = RunContext<typeof data>;

// ─── Modal + button builders ────────────────────────────────────────────────

function buildScriptModal(name: string, def: ScriptDefinitionValue | null): ModalBuilder {
  const field = (
    id: string,
    label: string,
    style: TextInputStyle,
    value: string,
    required: boolean,
    maxLength: number,
    placeholder?: string,
  ): ActionRowBuilder<TextInputBuilder> => {
    const input = new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
      .setMaxLength(maxLength);
    if (value) input.setValue(value);
    if (placeholder) input.setPlaceholder(placeholder);
    return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  };

  return new ModalBuilder()
    .setCustomId(`scr:modal:${name}`)
    .setTitle(`Script: ${name}`.slice(0, 45))
    .addComponents(
      field(
        "source",
        "Source (TypeScript body)",
        TextInputStyle.Paragraph,
        def?.source ?? "",
        true,
        4000,
        "return ctx.members.length;",
      ),
      field("description", "Description", TextInputStyle.Short, def?.description ?? "", false, 200),
      field(
        "capabilities",
        "Capabilities (comma-separated)",
        TextInputStyle.Short,
        def?.capabilities.join(", ") ?? "",
        false,
        100,
        "roles, messaging, channels",
      ),
    );
}

function confirmRow(name: string): V2Top {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`scr:run:${name}`)
      .setLabel("Apply")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("scr:cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

function deleteRow(name: string): V2Top {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`scr:delete:${name}`)
      .setLabel("Delete")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("scr:cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

async function replyEphemeral(
  interaction: ChatInputCommandInteraction,
  ...children: V2Top[]
): Promise<void> {
  const payload = v2Message(...children);
  await interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
}

// ─── Subcommand handlers ─────────────────────────────────────────────────────

async function handleCreate(c: Extract<ScriptCtx, { subcommand: "create" }>): Promise<void> {
  const name = parseScriptName(c.options.name);
  if (!name) {
    await replyEphemeral(
      c.interaction,
      container("danger", text("Invalid name. Use letters, numbers, `-` or `_`.")),
    );
    return;
  }
  if (LIBRARY_SCRIPTS.has(name)) {
    await replyEphemeral(
      c.interaction,
      container("mute", text(`\`${name}\` is a built-in script and can't be overridden.`)),
    );
    return;
  }
  const existing = await c.ctx.get(scriptId(c.guildId, name), ScriptDefinition);
  if (existing) {
    await replyEphemeral(
      c.interaction,
      container(
        "mute",
        text(`A script named \`${name}\` already exists. Use \`/script edit ${name}\`.`),
      ),
    );
    return;
  }
  await c.interaction.showModal(buildScriptModal(name, null));
}

async function handleEdit(c: Extract<ScriptCtx, { subcommand: "edit" }>): Promise<void> {
  const name = parseScriptName(c.options.name);
  if (!name) {
    await replyEphemeral(c.interaction, container("danger", text("Invalid script name.")));
    return;
  }
  if (LIBRARY_SCRIPTS.has(name)) {
    await replyEphemeral(
      c.interaction,
      container("mute", text(`\`${name}\` is a built-in script and can't be edited.`)),
    );
    return;
  }
  const def = await c.ctx.get(scriptId(c.guildId, name), ScriptDefinition);
  if (!def) {
    await replyEphemeral(c.interaction, container("mute", text(`No script named \`${name}\`.`)));
    return;
  }
  await c.interaction.showModal(buildScriptModal(name, def));
}

async function handleRun(c: Extract<ScriptCtx, { subcommand: "run" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });
  const name = parseScriptName(c.options.name);
  if (!name) return c.fail("Invalid script name.");
  const runnable = await resolveRunnable(c.ctx, c.guildId, name);
  if (!runnable) return c.fail(`No script named \`${name}\`.`);
  if (runnable.kind === "stored" && !runnable.def.enabled) {
    return c.warn(`Script \`${name}\` is disabled.`);
  }

  const presented = await executeRunnable(c.guild, runnable, {
    dryRun: true,
    invoker: { id: c.userId, tag: c.user.tag },
    channel: c.interaction.channelId ? { id: c.interaction.channelId, name: "channel" } : null,
  });
  if (presented.operationCount === 0) return v2Message(presented.container);
  return v2Message(presented.container, confirmRow(name));
}

async function handleList(c: Extract<ScriptCtx, { subcommand: "list" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });
  const defs = await c.ctx.query(ScriptDefinition, { filter: { guildId: c.guildId } });
  if (defs.length === 0 && LIBRARY_SCRIPTS.size === 0) {
    return c.info("No scripts yet. Use `/script create` to author one.");
  }
  const children: ContainerChild[] = [text("## Scripts")];
  for (const builtin of LIBRARY_SCRIPTS.values()) {
    const caps = builtin.capabilities.length > 0 ? builtin.capabilities.join(", ") : "read-only";
    children.push(separator("sm"));
    children.push(text(`**${builtin.name}** — built-in · ${caps}\n-# ${builtin.description}`));
  }
  for (const def of defs.slice(0, 15)) {
    const caps = def.capabilities.length > 0 ? def.capabilities.join(", ") : "read-only";
    const state = def.enabled ? "" : " · disabled";
    children.push(separator("sm"));
    children.push(
      text(
        `**${def.name}** — ${caps} · ${describeTrigger(def.trigger)}${state}\n-# ${def.description || "no description"}`,
      ),
    );
  }
  return v2Message(container("info", ...children));
}

async function handleDelete(c: Extract<ScriptCtx, { subcommand: "delete" }>): Promise<void> {
  const name = parseScriptName(c.options.name);
  if (!name) {
    await replyEphemeral(c.interaction, container("danger", text("Invalid script name.")));
    return;
  }
  if (LIBRARY_SCRIPTS.has(name)) {
    await replyEphemeral(
      c.interaction,
      container("mute", text(`\`${name}\` is a built-in script and can't be deleted.`)),
    );
    return;
  }
  const def = await c.ctx.get(scriptId(c.guildId, name), ScriptDefinition);
  if (!def) {
    await replyEphemeral(c.interaction, container("mute", text(`No script named \`${name}\`.`)));
    return;
  }
  await replyEphemeral(
    c.interaction,
    container("danger", text(`## Delete \`${name}\`?\nThis cannot be undone.`)),
    deleteRow(name),
  );
}

/** Loads a stored (non-built-in) script for a trigger-config subcommand, replying on failure. */
async function loadStoredForConfig(
  interaction: ChatInputCommandInteraction,
  ctx: ScriptCtx["ctx"],
  guildId: string,
  name: string | null,
): Promise<ScriptDefinitionValue | null> {
  if (!name) {
    await replyEphemeral(interaction, container("danger", text("Invalid script name.")));
    return null;
  }
  if (LIBRARY_SCRIPTS.has(name)) {
    await replyEphemeral(
      interaction,
      container("mute", text(`\`${name}\` is a built-in script and can't be configured.`)),
    );
    return null;
  }
  const def = await ctx.get(scriptId(guildId, name), ScriptDefinition);
  if (!def) {
    await replyEphemeral(interaction, container("mute", text(`No script named \`${name}\`.`)));
    return null;
  }
  return def;
}

async function handleSchedule(c: Extract<ScriptCtx, { subcommand: "schedule" }>): Promise<void> {
  const name = parseScriptName(c.options.name);
  const def = await loadStoredForConfig(c.interaction, c.ctx, c.guildId, name);
  if (!def) return;

  const hours = c.options.hours;
  const channel = c.options.channel;
  await c.ctx.patch(scriptId(c.guildId, def.name), ScriptDefinition, {
    trigger: { kind: "schedule", intervalHours: hours },
    reportChannelId: channel?.id ?? def.reportChannelId,
    scheduleNextRunAt: new Date(Date.now() + hours * 3_600_000),
    updatedAt: new Date(),
  });
  const where = channel ? `, reporting in <#${channel.id}>` : "";
  await replyEphemeral(
    c.interaction,
    container("ok", text(`Scheduled \`${def.name}\` every ${hours}h${where}.`)),
  );
}

async function handleManual(c: Extract<ScriptCtx, { subcommand: "manual" }>): Promise<void> {
  const name = parseScriptName(c.options.name);
  const def = await loadStoredForConfig(c.interaction, c.ctx, c.guildId, name);
  if (!def) return;

  await c.ctx.patch(scriptId(c.guildId, def.name), ScriptDefinition, {
    trigger: { kind: "manual" },
    scheduleNextRunAt: null,
    updatedAt: new Date(),
  });
  await replyEphemeral(c.interaction, container("ok", text(`\`${def.name}\` is now manual-only.`)));
}

export default data
  .help({ hints: [] })
  .handle("create", handleCreate)
  .handle("edit", handleEdit)
  .handle("run", handleRun)
  .handle("list", handleList)
  .handle("delete", handleDelete)
  .handle("schedule", handleSchedule)
  .handle("manual", handleManual);

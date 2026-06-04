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
  SCRIPT_EVENTS,
  ScriptDefinition,
  type ScriptDefinitionValue,
  type ScriptEvent,
  scriptId,
} from "@/components/script-definition";
import { sessions } from "@/core/state";
import { command, type RunContext } from "@/framework";
import { type ContainerChild, container, separator, text, type V2Top, v2Message } from "@/ui/v2";
import { renderCollector, sessionKey } from "../input-collector";
import { LIBRARY_SCRIPTS } from "../library";
import { describeTrigger, parseScriptName } from "../model";
import { saveExistingScript } from "../persistence";
import { resolveRunnable } from "../resolve";
import { scriptRoutes } from "../routes";
import { executeRunnable, scanInputsFromRunnable } from "../run";

const data = command("script")
  .description("Author and run server scripts")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .subcommand({
    name: "create",
    description: "Create a new script",
    options: (s) => s.string("name", "Unique script name", { required: true }),
  })
  .subcommand({
    name: "edit",
    description: "Edit an existing script",
    options: (s) => s.string("name", "Script name", { required: true }),
  })
  .subcommand({
    name: "run",
    description: "Run a script (previews the plan first)",
    options: (s) => s.string("name", "Script name", { required: true }),
  })
  .subcommand({ name: "list", description: "List this server's scripts" })
  .subcommand({
    name: "delete",
    description: "Delete a script",
    options: (s) => s.string("name", "Script name", { required: true }),
  })
  .subcommand({
    name: "schedule",
    description: "Run a script on a recurring interval",
    options: (s) =>
      s
        .string("name", "Script name", { required: true })
        .integer("hours", "Interval in hours", { required: true, min: 1, max: 168 })
        .channel("channel", "Channel to post run summaries in"),
  })
  .subcommand({
    name: "on",
    description: "Run a script when a Discord event fires",
    options: (s) =>
      s
        .string("name", "Script name", { required: true })
        .string("event", "Event to bind", {
          required: true,
          choices: [{ name: "member join", value: "member-join" }],
        })
        .channel("channel", "Channel to post run summaries in"),
  })
  .subcommand({
    name: "manual",
    description: "Clear a script's trigger (run only via /script run)",
    options: (s) => s.string("name", "Script name", { required: true }),
  })
  .subcommand({ name: "help", description: "Show the script authoring reference" })
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
    .setCustomId(scriptRoutes.modal.id({ name }))
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
      .setCustomId(scriptRoutes.run.id({ name }))
      .setLabel("Apply")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(scriptRoutes.cancel.id({}))
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

function deleteRow(name: string): V2Top {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(scriptRoutes.delete.id({ name }))
      .setLabel("Delete")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(scriptRoutes.cancel.id({}))
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
  const name = parseScriptName(c.options.name);
  if (!name) {
    await replyEphemeral(c.interaction, container("danger", text("Invalid script name.")));
    return;
  }
  const runnable = await resolveRunnable(c.ctx, c.guildId, name);
  if (!runnable) {
    await replyEphemeral(c.interaction, container("mute", text(`No script named \`${name}\`.`)));
    return;
  }
  if (runnable.kind === "stored" && !runnable.def.enabled) {
    await replyEphemeral(c.interaction, container("mute", text(`Script \`${name}\` is disabled.`)));
    return;
  }

  // Declared inputs → show the collector (ephemeral message) and gather values there.
  const inputFields = scanInputsFromRunnable(runnable);
  if (inputFields.length > 0) {
    sessions.set(sessionKey(c.userId, c.guildId, name), {
      runnable,
      fields: inputFields,
      values: {},
    });
    await c.ctx.respond.defer({ visibility: "ephemeral" });
    return renderCollector(name, inputFields, {});
  }

  // No inputs — defer and run immediately.
  await c.ctx.respond.defer({ visibility: "ephemeral" });
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
  await saveExistingScript(c.ctx, scriptId(c.guildId, def.name), def, {
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

async function handleOn(c: Extract<ScriptCtx, { subcommand: "on" }>): Promise<void> {
  const name = parseScriptName(c.options.name);
  const def = await loadStoredForConfig(c.interaction, c.ctx, c.guildId, name);
  if (!def) return;

  const event = c.options.event;
  if (!(SCRIPT_EVENTS as readonly string[]).includes(event)) {
    await replyEphemeral(c.interaction, container("danger", text(`Unknown event \`${event}\`.`)));
    return;
  }
  const channel = c.options.channel;
  await saveExistingScript(c.ctx, scriptId(c.guildId, def.name), def, {
    trigger: { kind: "event", event: event as ScriptEvent },
    reportChannelId: channel?.id ?? def.reportChannelId,
    scheduleNextRunAt: null,
    updatedAt: new Date(),
  });
  const where = channel ? `, reporting in <#${channel.id}>` : "";
  await replyEphemeral(
    c.interaction,
    container("ok", text(`\`${def.name}\` now runs on \`${event}\`${where}.`)),
  );
}

async function handleManual(c: Extract<ScriptCtx, { subcommand: "manual" }>): Promise<void> {
  const name = parseScriptName(c.options.name);
  const def = await loadStoredForConfig(c.interaction, c.ctx, c.guildId, name);
  if (!def) return;

  await saveExistingScript(c.ctx, scriptId(c.guildId, def.name), def, {
    trigger: { kind: "manual" },
    scheduleNextRunAt: null,
    updatedAt: new Date(),
  });
  await replyEphemeral(c.interaction, container("ok", text(`\`${def.name}\` is now manual-only.`)));
}

function handleHelp(_c: Extract<ScriptCtx, { subcommand: "help" }>) {
  const HELP_TEXT = [
    "## Script Reference",
    "-# Scripts are TypeScript bodies — write statements and use `return` to output.",

    "\n### ctx — available in every script",
    "`ctx.guild` — `{ id, name, memberCount }`",
    "`ctx.members` — list of members; each has `.has_role(name)`, `.joined_days_ago()`, `.mention()`, `.role_names()`",
    "`ctx.roles` — list of `{ id, name }` (includes @everyone)",
    "`ctx.channels` — list of `{ id, name }`",
    "`ctx.invoker` — `{ id, tag }` of who triggered the script, or null for automated runs",
    "`ctx.now` — epoch milliseconds",
    "`ctx.input` — values collected from the input form (e.g. `ctx.input.role`)",
    '`ctx.find_role("@name" | "<@&id>" | name)` — resolves a role from the snapshot',
    '`ctx.find_member(tag | "<@id>" | id)` — resolves a member',
    "`ctx.members_with_role(name)` — all members who have that role",

    "\n### Output helpers (use as bare names — no import needed)",
    '`title("text")` — heading at the top of the result',
    "`sep()` — visible divider between sections",
    '`footer("text")` — small caption at the bottom',
    '`field("Key", "Value")` — key-value line',
    '`display("text")` — plain text block',
    '`color("ok"|"warn"|"danger"|"info"|"mute")` — set the result\'s accent color',
    "-# Arrays return as bullet lists; objects return as key-value pairs automatically.",

    "\n### Inputs (shown in a form before the script runs)",
    '`input.text("name", "Label")` — single-line text',
    '`input.number("name", "Label")` — validated number',
    '`input.role("name", "Label")` — native role picker',
    '`input.member("name", "Label")` — native member picker',
    '`input.channel("name", "Label")` — native channel picker',
    "-# Values arrive as strings in `ctx.input.name`. Role/member/channel give an id — resolve with `ctx.find_role`/`find_member`. Up to 4 picker inputs.",
    '`fail_input("message")` — reject the inputs and re-open the form with your message',

    "\n### Capabilities (comma-separated in the Capabilities field)",
    "`roles` → `ctx.addRole(member, roleName)`, `ctx.removeRole(member, roleName)`",
    '`messaging` → `ctx.dm(member, "text")`',
    "`channels` → `ctx.createChannel({ name, type? })`, `ctx.createRole({ name, color? })`",
    "-# Scripts without a capability are read-only and cannot perform that action.",
  ].join("\n");

  const EXAMPLES_TEXT = [
    "### Examples",
    "",
    "**List all roles:**",
    '`return ctx.roles.filter(r => r.name !== "@everyone").map(r => r.name);`',
    "",
    "**Structured result:**",
    '`return [title("Stats"), { members: ctx.guild.memberCount }, footer(ctx.guild.name)];`',
    "",
    "**Grant role to recent joiners (needs** `roles`**)**",
    "`const n = ctx.members.filter(m => (m.joined_days_ago() ?? 999) < 7);`",
    '`for (const m of n) ctx.addRole(m, "Newcomer");`',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional — this is example code shown to users
    '`return [title("Tagged"), footer(`${n.length} members`)];`',
    "",
    "**Count members with a specific role (uses inputs)**",
    '`input.role("role", "Pick the role to count");`',
    "`const role = ctx.find_role(ctx.input.role);`",
    '`if (!role) fail_input("That role no longer exists — pick another.");`',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional — this is example code shown to users
    "`return [title(`Members with ${role.name}`), { count: ctx.members_with_role(role.id).length }];`",
  ].join("\n");

  return v2Message(container("info", text(HELP_TEXT), separator("sm"), text(EXAMPLES_TEXT)));
}

export default data
  .help({ hints: [] })
  .handle("create", handleCreate)
  .handle("edit", handleEdit)
  .handle("run", handleRun)
  .handle("list", handleList)
  .handle("delete", handleDelete)
  .handle("schedule", handleSchedule)
  .handle("on", handleOn)
  .handle("manual", handleManual)
  .handle("help", handleHelp);

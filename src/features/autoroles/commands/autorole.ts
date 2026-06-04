import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
  type Role,
} from "discord.js";
import {
  AutoroleRule,
  type AutoroleTriggerValue,
  autoroleRuleId,
} from "@/components/autorole-rule";
import { routes } from "@/features/autoroles/routes";
import { normalizeEmoji, parseDurationMs } from "@/features/autoroles/rules";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, section, text, v2Message } from "@/ui/v2";

const data = command("autorole")
  .description("Manage automatic role assignment rules")
  .defaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .guildOnly()
  .defer("ephemeral")
  .subcommand("create", "Create a rule", (s) =>
    s
      .string("name", "Unique rule name", { required: true })
      .string("trigger", "When to grant the role", {
        required: true,
        choices: [
          { name: "On Join", value: "onJoin" },
          { name: "On Reaction", value: "onReact" },
          { name: "Message Contains", value: "messageContains" },
        ],
      })
      .role("role", "Role to grant", { required: true })
      .string("message_id", "Message ID for reactions")
      .string("emoji", "Emoji for reactions, or *")
      .string("keywords", "Comma-separated keywords")
      .string("duration", "Optional duration: 30m, 2h, 7d"),
  )
  .subcommand("delete", "Delete a rule", (s) => s.string("name", "Rule name", { required: true }))
  .subcommand("list", "List rules")
  .subcommand("enable", "Enable a rule", (s) => s.string("name", "Rule name", { required: true }))
  .subcommand("disable", "Disable a rule", (s) => s.string("name", "Rule name", { required: true }))
  .group("prompt", "Post a self-role prompt and create its rule", (g) =>
    g
      .subcommand("reaction", "Post a reaction-role prompt", (s) =>
        s
          .channel("channel", "Channel to post in", {
            required: true,
            channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
          })
          .role("role", "Role to grant", { required: true })
          .string("emoji", "Reaction emoji", { required: true })
          .string("title", "Prompt title")
          .string("description", "Prompt text")
          .string("duration", "Optional duration: 30m, 2h, 7d")
          .string("name", "Rule name"),
      )
      .subcommand("button", "Post a button self-role prompt", (s) =>
        s
          .channel("channel", "Channel to post in", {
            required: true,
            channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
          })
          .role("role", "Role to toggle", { required: true })
          .string("label", "Button label")
          .string("title", "Prompt title")
          .string("description", "Prompt text")
          .string("duration", "Optional duration: 30m, 2h, 7d")
          .string("name", "Rule name"),
      ),
  )
  .group("attach", "Attach a rule to an existing prompt message", (g) =>
    g
      .subcommand("reaction", "Attach a reaction-role rule", (s) =>
        s
          .string("message_id", "Message ID", { required: true })
          .role("role", "Role to grant", { required: true })
          .string("emoji", "Reaction emoji", { required: true })
          .string("duration", "Optional duration: 30m, 2h, 7d")
          .string("name", "Rule name"),
      )
      .subcommand("button", "Attach a button self-role rule", (s) =>
        s
          .string("message_id", "Message ID", { required: true })
          .role("role", "Role to toggle", { required: true })
          .string("label", "Button label")
          .string("duration", "Optional duration: 30m, 2h, 7d")
          .string("name", "Rule name"),
      ),
  );

async function handleCreate(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const guildId = requireGuild(interaction, ctx);
  if (!guildId) return;

  const role = await requireManageableRole(interaction, ctx);
  if (!role) return;

  let trigger: AutoroleTriggerValue;
  const triggerType = interaction.options.getString("trigger", true);
  if (triggerType === "onJoin") {
    trigger = { type: "onJoin" };
  } else if (triggerType === "onReact") {
    const messageId = interaction.options.getString("message_id");
    const emoji = interaction.options.getString("emoji");
    if (!messageId || !emoji) {
      await ctx.respond.send({ content: "Reaction rules require `message_id` and `emoji`." });
      return;
    }
    trigger = { type: "onReact", messageId, emoji: normalizeEmoji(emoji) };
  } else {
    const keywords = parseKeywords(interaction.options.getString("keywords"));
    if (keywords.length === 0) {
      await ctx.respond.send({ content: "Message rules require at least one keyword." });
      return;
    }
    trigger = { type: "messageContains", keywords };
  }

  const name = interaction.options.getString("name", true);
  const durationMs = parseDurationForReply(interaction, ctx);
  if (durationMs === undefined) return;
  await saveRule(ctx, guildId, name, trigger, role.id, durationMs);
  const summary = [
    `**Name:** ${name}`,
    `**Trigger:** ${trigger.type}`,
    `**Role:** <@&${role.id}>`,
    `**Duration:** ${durationMs ? formatDuration(durationMs) : "Permanent"}`,
  ].join("\n");
  await ctx.respond.send(v2Message(container("ok", text(`## Autorole Rule Created\n${summary}`))));
}

async function handlePrompt(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
  sub: string,
): Promise<void> {
  const guildId = requireGuild(interaction, ctx);
  if (!guildId) return;

  const role = await requireManageableRole(interaction, ctx);
  if (!role) return;

  const channel = interaction.options.getChannel("channel", true);
  if (!canSend(channel)) {
    await ctx.respond.send({ content: "Choose a text channel I can post in." });
    return;
  }

  const title = interaction.options.getString("title") ?? `Choose ${role.name}`;
  const description =
    interaction.options.getString("description") ?? `Use this prompt to manage <@&${role.id}>.`;
  const durationMs = parseDurationForReply(interaction, ctx);
  if (durationMs === undefined) return;

  /**
   * Channel prompt messages use V2 containers so they match the rest of the bot
   * UI. The `components` array is cast at the send/edit boundary because discord.js
   * types don't yet include ContainerBuilder in MessageCreateOptions/MessageEditOptions.
   */
  const message = await channel.send(
    // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not yet in discord.js MessageCreateOptions types.
    v2Message(container("info", text(`## ${title}\n${description}`))) as any,
  );

  if (sub === "reaction") {
    const emojiInput = interaction.options.getString("emoji", true);
    await message.react(emojiInput).catch(() => null);
    const name = interaction.options.getString("name") ?? `reaction-${message.id}-${role.id}`;
    await saveRule(
      ctx,
      guildId,
      name,
      { type: "onReact", messageId: message.id, emoji: normalizeEmoji(emojiInput) },
      role.id,
      durationMs,
    );
    await ctx.respond.send({ content: `Reaction role prompt posted: ${message.url}` });
    return;
  }

  const label = interaction.options.getString("label") ?? role.name;
  const name = interaction.options.getString("name") ?? `button-${message.id}-${role.id}`;
  const selfRoleButton = new ButtonBuilder()
    .setCustomId(routes.toggle.id({ message: message.id, role: role.id }))
    .setLabel(label)
    .setStyle(ButtonStyle.Primary);
  await message.edit({
    // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not yet in discord.js MessageEditOptions types.
    components: [container("info", section(`## ${title}\n${description}`, selfRoleButton))] as any,
    flags: MessageFlags.IsComponentsV2,
  });
  await saveRule(
    ctx,
    guildId,
    name,
    { type: "onButton", messageId: message.id, label },
    role.id,
    durationMs,
  );
  await ctx.respond.send({ content: `Button role prompt posted: ${message.url}` });
}

async function handleAttach(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
  sub: string,
): Promise<void> {
  const guildId = requireGuild(interaction, ctx);
  if (!guildId) return;

  const role = await requireManageableRole(interaction, ctx);
  if (!role) return;

  const messageId = interaction.options.getString("message_id", true);
  const durationMs = parseDurationForReply(interaction, ctx);
  if (durationMs === undefined) return;
  const label = interaction.options.getString("label") ?? role.name;
  const name = interaction.options.getString("name") ?? `${sub}-${messageId}-${role.id}`;
  const trigger: AutoroleTriggerValue =
    sub === "reaction"
      ? {
          type: "onReact",
          messageId,
          emoji: normalizeEmoji(interaction.options.getString("emoji", true)),
        }
      : { type: "onButton", messageId, label };

  await saveRule(ctx, guildId, name, trigger, role.id, durationMs);
  await ctx.respond.send({
    content:
      sub === "button"
        ? `Rule saved. Add a button with custom ID \`${routes.toggle.id({ message: messageId, role: role.id })}\` to that message.`
        : "Reaction rule saved.",
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const guildId = requireGuild(interaction, ctx);
  if (!guildId) return;

  const name = interaction.options.getString("name", true);
  const id = autoroleRuleId(guildId, name);
  const existing = await ctx.get(id, AutoroleRule);
  if (!existing) {
    await ctx.respond.send({ content: `No rule named **${name}** found.` });
    return;
  }
  await ctx.delete(id, AutoroleRule);
  await ctx.respond.send({ content: `Rule **${name}** has been deleted.` });
}

async function handleList(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const guildId = requireGuild(interaction, ctx);
  if (!guildId) return;

  const rules = await listRules(ctx, guildId);
  if (rules.length === 0) {
    await ctx.respond.send({ content: "No autorole rules configured." });
    return;
  }

  const lines = rules.map((rule) => {
    const trigger =
      rule.trigger.type === "onReact"
        ? `reaction ${rule.trigger.emoji} on ${rule.trigger.messageId}`
        : rule.trigger.type === "onButton"
          ? `button on ${rule.trigger.messageId}`
          : rule.trigger.type === "messageContains"
            ? `message contains ${rule.trigger.keywords.join(", ")}`
            : "join";
    const duration = rule.durationMs ? ` for ${formatDuration(rule.durationMs)}` : "";
    return `${rule.enabled ? "On" : "Off"} **${rule.name}** -> <@&${rule.roleId}> (${trigger}${duration})`;
  });

  await ctx.respond.send(
    v2Message(container("info", text(`## Autorole Rules\n${lines.join("\n")}`))),
  );
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
  enabled: boolean,
): Promise<void> {
  const guildId = requireGuild(interaction, ctx);
  if (!guildId) return;

  const name = interaction.options.getString("name", true);
  const id = autoroleRuleId(guildId, name);
  const existing = await ctx.get(id, AutoroleRule);
  if (!existing) {
    await ctx.respond.send({ content: `No rule named **${name}** found.` });
    return;
  }
  await ctx.patch(id, AutoroleRule, { enabled });
  await ctx.respond.send({
    content: `Rule **${name}** is now ${enabled ? "enabled" : "disabled"}.`,
  });
}

async function saveRule(
  ctx: Ctx,
  guildId: string,
  name: string,
  trigger: AutoroleTriggerValue,
  roleId: string,
  durationMs: number | null,
): Promise<void> {
  await ctx.set(autoroleRuleId(guildId, name), AutoroleRule, {
    guildId,
    name,
    enabled: true,
    trigger,
    roleId,
    durationMs,
    createdAt: new Date(),
  });
}

async function listRules(ctx: Ctx, guildId: string) {
  return ctx.query(AutoroleRule, { filter: { guildId } });
}

function requireGuild(interaction: ChatInputCommandInteraction, ctx: Ctx): string | null {
  if (interaction.guildId && interaction.guild) return interaction.guildId;
  void ctx.respond.send({ content: "This command can only be used in a server." });
  return null;
}

async function requireManageableRole(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
): Promise<Role | null> {
  const selected = interaction.options.getRole("role", true);
  const role = await interaction.guild?.roles.fetch(selected.id);
  const me =
    interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe().catch(() => null));
  if (!role || !me) {
    await ctx.respond.send({ content: "I could not resolve that role or my member record." });
    return null;
  }
  if (role.managed) {
    await ctx.respond.send({
      content: "Managed integration roles cannot be assigned by autoroles.",
    });
    return null;
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await ctx.respond.send({ content: "I need Manage Roles to assign autoroles." });
    return null;
  }
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    await ctx.respond.send({ content: `Move my highest role above <@&${role.id}> first.` });
    return null;
  }
  return role;
}

type PromptChannel = {
  isTextBased(): boolean;
  // biome-ignore lint/suspicious/noExplicitAny: V2 payload is valid at runtime; discord.js types lag behind.
  send(payload: any): Promise<Message>;
};

function canSend(channel: unknown): channel is PromptChannel {
  return (
    typeof channel === "object" &&
    channel !== null &&
    "isTextBased" in channel &&
    typeof channel.isTextBased === "function" &&
    channel.isTextBased() &&
    "send" in channel &&
    typeof channel.send === "function"
  );
}

function parseKeywords(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function parseDurationForReply(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
): number | null | undefined {
  try {
    return parseDurationMs(interaction.options.getString("duration"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid duration.";
    void ctx.respond.send({ content: message });
    return undefined;
  }
}

function formatDuration(ms: number): string {
  if (ms % (24 * 60 * 60_000) === 0) return `${ms / (24 * 60 * 60_000)}d`;
  if (ms % (60 * 60_000) === 0) return `${ms / (60 * 60_000)}h`;
  return `${ms / 60_000}m`;
}

type AutoroleHandler = (interaction: ChatInputCommandInteraction, ctx: Ctx) => Promise<void>;
const dispatch: Record<string, AutoroleHandler> = {
  "prompt:reaction": (i, c) => handlePrompt(i, c, "reaction"),
  "prompt:button": (i, c) => handlePrompt(i, c, "button"),
  "attach:reaction": (i, c) => handleAttach(i, c, "reaction"),
  "attach:button": (i, c) => handleAttach(i, c, "button"),
  create: handleCreate,
  delete: handleDelete,
  list: handleList,
  enable: (i, c) => handleToggle(i, c, true),
  disable: (i, c) => handleToggle(i, c, false),
};

export default data.help({ hints: [] }).run(async (c) => {
  const key = c.subcommandGroup ? `${c.subcommandGroup}:${c.subcommand}` : (c.subcommand ?? "");
  await dispatch[key]?.(c.interaction, c.ctx);
});

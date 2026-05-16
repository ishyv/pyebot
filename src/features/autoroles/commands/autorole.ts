import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
  type Role,
  SlashCommandBuilder,
} from "discord.js";
import {
  AutoroleRule,
  type AutoroleTriggerValue,
  autoroleRuleId,
} from "@/components/autorole-rule";
import { autoroleButtonId, normalizeEmoji, parseDurationMs } from "@/features/autoroles/rules";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, section, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("autorole")
  .setDescription("Manage automatic role assignment rules")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a rule")
      .addStringOption((o) =>
        o.setName("name").setDescription("Unique rule name").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("trigger")
          .setDescription("When to grant the role")
          .setRequired(true)
          .addChoices(
            { name: "On Join", value: "onJoin" },
            { name: "On Reaction", value: "onReact" },
            { name: "Message Contains", value: "messageContains" },
          ),
      )
      .addRoleOption((o) => o.setName("role").setDescription("Role to grant").setRequired(true))
      .addStringOption((o) => o.setName("message_id").setDescription("Message ID for reactions"))
      .addStringOption((o) => o.setName("emoji").setDescription("Emoji for reactions, or *"))
      .addStringOption((o) => o.setName("keywords").setDescription("Comma-separated keywords"))
      .addStringOption((o) =>
        o.setName("duration").setDescription("Optional duration: 30m, 2h, 7d"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a rule")
      .addStringOption((o) => o.setName("name").setDescription("Rule name").setRequired(true)),
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List rules"))
  .addSubcommand((sub) =>
    sub
      .setName("enable")
      .setDescription("Enable a rule")
      .addStringOption((o) => o.setName("name").setDescription("Rule name").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("disable")
      .setDescription("Disable a rule")
      .addStringOption((o) => o.setName("name").setDescription("Rule name").setRequired(true)),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("prompt")
      .setDescription("Post a self-role prompt and create its rule")
      .addSubcommand((sub) =>
        sub
          .setName("reaction")
          .setDescription("Post a reaction-role prompt")
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Channel to post in")
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
          )
          .addRoleOption((o) => o.setName("role").setDescription("Role to grant").setRequired(true))
          .addStringOption((o) =>
            o.setName("emoji").setDescription("Reaction emoji").setRequired(true),
          )
          .addStringOption((o) => o.setName("title").setDescription("Prompt title"))
          .addStringOption((o) => o.setName("description").setDescription("Prompt text"))
          .addStringOption((o) =>
            o.setName("duration").setDescription("Optional duration: 30m, 2h, 7d"),
          )
          .addStringOption((o) => o.setName("name").setDescription("Rule name")),
      )
      .addSubcommand((sub) =>
        sub
          .setName("button")
          .setDescription("Post a button self-role prompt")
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Channel to post in")
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
          )
          .addRoleOption((o) =>
            o.setName("role").setDescription("Role to toggle").setRequired(true),
          )
          .addStringOption((o) => o.setName("label").setDescription("Button label"))
          .addStringOption((o) => o.setName("title").setDescription("Prompt title"))
          .addStringOption((o) => o.setName("description").setDescription("Prompt text"))
          .addStringOption((o) =>
            o.setName("duration").setDescription("Optional duration: 30m, 2h, 7d"),
          )
          .addStringOption((o) => o.setName("name").setDescription("Rule name")),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("attach")
      .setDescription("Attach a rule to an existing prompt message")
      .addSubcommand((sub) =>
        sub
          .setName("reaction")
          .setDescription("Attach a reaction-role rule")
          .addStringOption((o) =>
            o.setName("message_id").setDescription("Message ID").setRequired(true),
          )
          .addRoleOption((o) => o.setName("role").setDescription("Role to grant").setRequired(true))
          .addStringOption((o) =>
            o.setName("emoji").setDescription("Reaction emoji").setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("duration").setDescription("Optional duration: 30m, 2h, 7d"),
          )
          .addStringOption((o) => o.setName("name").setDescription("Rule name")),
      )
      .addSubcommand((sub) =>
        sub
          .setName("button")
          .setDescription("Attach a button self-role rule")
          .addStringOption((o) =>
            o.setName("message_id").setDescription("Message ID").setRequired(true),
          )
          .addRoleOption((o) =>
            o.setName("role").setDescription("Role to toggle").setRequired(true),
          )
          .addStringOption((o) => o.setName("label").setDescription("Button label"))
          .addStringOption((o) =>
            o.setName("duration").setDescription("Optional duration: 30m, 2h, 7d"),
          )
          .addStringOption((o) => o.setName("name").setDescription("Rule name")),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (group === "prompt") return handlePrompt(interaction, ctx, sub);
  if (group === "attach") return handleAttach(interaction, ctx, sub);
  if (sub === "create") return handleCreate(interaction, ctx);
  if (sub === "delete") return handleDelete(interaction, ctx);
  if (sub === "list") return handleList(interaction, ctx);
  if (sub === "enable") return handleToggle(interaction, ctx, true);
  if (sub === "disable") return handleToggle(interaction, ctx, false);
}

async function handleCreate(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = requireGuild(interaction);
  if (!guildId) return;

  const role = await requireManageableRole(interaction);
  if (!role) return;

  let trigger: AutoroleTriggerValue;
  const triggerType = interaction.options.getString("trigger", true);
  if (triggerType === "onJoin") {
    trigger = { type: "onJoin" };
  } else if (triggerType === "onReact") {
    const messageId = interaction.options.getString("message_id");
    const emoji = interaction.options.getString("emoji");
    if (!messageId || !emoji) {
      await interaction.editReply({ content: "Reaction rules require `message_id` and `emoji`." });
      return;
    }
    trigger = { type: "onReact", messageId, emoji: normalizeEmoji(emoji) };
  } else {
    const keywords = parseKeywords(interaction.options.getString("keywords"));
    if (keywords.length === 0) {
      await interaction.editReply({ content: "Message rules require at least one keyword." });
      return;
    }
    trigger = { type: "messageContains", keywords };
  }

  const name = interaction.options.getString("name", true);
  const durationMs = parseDurationForReply(interaction);
  if (durationMs === undefined) return;
  await saveRule(ctx, guildId, name, trigger, role.id, durationMs);
  const summary = [
    `**Name:** ${name}`,
    `**Trigger:** ${trigger.type}`,
    `**Role:** <@&${role.id}>`,
    `**Duration:** ${durationMs ? formatDuration(durationMs) : "Permanent"}`,
  ].join("\n");
  await interaction.editReply(
    v2Message(container("ok", text(`## Autorole Rule Created\n${summary}`))),
  );
}

async function handlePrompt(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
  sub: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = requireGuild(interaction);
  if (!guildId) return;

  const role = await requireManageableRole(interaction);
  if (!role) return;

  const channel = interaction.options.getChannel("channel", true);
  if (!canSend(channel)) {
    await interaction.editReply({ content: "Choose a text channel I can post in." });
    return;
  }

  const title = interaction.options.getString("title") ?? `Choose ${role.name}`;
  const description =
    interaction.options.getString("description") ?? `Use this prompt to manage <@&${role.id}>.`;
  const durationMs = parseDurationForReply(interaction);
  if (durationMs === undefined) return;

  /**
   * Channel prompt messages use V2 containers so they match the rest of the bot
   * UI. The `components` array is cast at the send/edit boundary because discord.js
   * types don't yet include ContainerBuilder in MessageCreateOptions/MessageEditOptions.
   */
  // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not yet in discord.js MessageCreateOptions types.
  const message = await channel.send(
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
    await interaction.editReply({ content: `Reaction role prompt posted: ${message.url}` });
    return;
  }

  const label = interaction.options.getString("label") ?? role.name;
  const name = interaction.options.getString("name") ?? `button-${message.id}-${role.id}`;
  const selfRoleButton = new ButtonBuilder()
    .setCustomId(autoroleButtonId(message.id, role.id))
    .setLabel(label)
    .setStyle(ButtonStyle.Primary);
  // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not yet in discord.js MessageEditOptions types.
  await message.edit({
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
  await interaction.editReply({ content: `Button role prompt posted: ${message.url}` });
}

async function handleAttach(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
  sub: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = requireGuild(interaction);
  if (!guildId) return;

  const role = await requireManageableRole(interaction);
  if (!role) return;

  const messageId = interaction.options.getString("message_id", true);
  const durationMs = parseDurationForReply(interaction);
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
  await interaction.editReply({
    content:
      sub === "button"
        ? `Rule saved. Add a button with custom ID \`${autoroleButtonId(messageId, role.id)}\` to that message.`
        : "Reaction rule saved.",
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = requireGuild(interaction);
  if (!guildId) return;

  const name = interaction.options.getString("name", true);
  const id = autoroleRuleId(guildId, name);
  const existing = await ctx.get(id, AutoroleRule);
  if (!existing) {
    await interaction.editReply({ content: `No rule named **${name}** found.` });
    return;
  }
  await ctx.delete(id, AutoroleRule);
  await interaction.editReply({ content: `Rule **${name}** has been deleted.` });
}

async function handleList(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = requireGuild(interaction);
  if (!guildId) return;

  const rules = await listRules(ctx, guildId);
  if (rules.length === 0) {
    await interaction.editReply({ content: "No autorole rules configured." });
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

  await interaction.editReply(
    v2Message(container("info", text(`## Autorole Rules\n${lines.join("\n")}`))),
  );
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
  enabled: boolean,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = requireGuild(interaction);
  if (!guildId) return;

  const name = interaction.options.getString("name", true);
  const id = autoroleRuleId(guildId, name);
  const existing = await ctx.get(id, AutoroleRule);
  if (!existing) {
    await interaction.editReply({ content: `No rule named **${name}** found.` });
    return;
  }
  await ctx.patch(id, AutoroleRule, { enabled });
  await interaction.editReply({
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

function requireGuild(interaction: ChatInputCommandInteraction): string | null {
  if (interaction.guildId && interaction.guild) return interaction.guildId;
  void interaction.editReply({ content: "This command can only be used in a server." });
  return null;
}

async function requireManageableRole(
  interaction: ChatInputCommandInteraction,
): Promise<Role | null> {
  const selected = interaction.options.getRole("role", true);
  const role = await interaction.guild?.roles.fetch(selected.id);
  const me =
    interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe().catch(() => null));
  if (!role || !me) {
    await interaction.editReply({ content: "I could not resolve that role or my member record." });
    return null;
  }
  if (role.managed) {
    await interaction.editReply({
      content: "Managed integration roles cannot be assigned by autoroles.",
    });
    return null;
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({ content: "I need Manage Roles to assign autoroles." });
    return null;
  }
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    await interaction.editReply({ content: `Move my highest role above <@&${role.id}> first.` });
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
): number | null | undefined {
  try {
    return parseDurationMs(interaction.options.getString("duration"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid duration.";
    void interaction.editReply({ content: message });
    return undefined;
  }
}

function formatDuration(ms: number): string {
  if (ms % (24 * 60 * 60_000) === 0) return `${ms / (24 * 60 * 60_000)}d`;
  if (ms % (60 * 60_000) === 0) return `${ms / (60 * 60_000)}h`;
  return `${ms / 60_000}m`;
}

export default defineCommand({
  data,
  help: { hints: [] },
  execute,
});

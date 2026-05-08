/**
 * /autorole create <name> <trigger-type> <role> [options...]
 * /autorole delete <name>
 * /autorole list
 * /autorole enable <name>
 * /autorole disable <name>
 */

import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  createRule,
  deleteRule,
  listRules,
  setEnabled,
  type AutoroleTrigger,
} from "@/features/autoroles/service";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";

export const data = new SlashCommandBuilder()
  .setName("autorole")
  .setDescription("Manage automatic role assignment rules")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new autorole rule")
      .addStringOption((o) =>
        o.setName("name").setDescription("Rule name (unique per server)").setRequired(true),
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
      .addRoleOption((o) =>
        o.setName("role").setDescription("Role to grant").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("message_id")
          .setDescription("Message ID (required for onReact)"),
      )
      .addStringOption((o) =>
        o
          .setName("emoji")
          .setDescription("Emoji (for onReact — use * to match any reaction)"),
      )
      .addStringOption((o) =>
        o
          .setName("keywords")
          .setDescription("Comma-separated keywords (for messageContains)"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a rule")
      .addStringOption((o) =>
        o.setName("name").setDescription("Rule name").setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List all rules"))
  .addSubcommand((sub) =>
    sub
      .setName("enable")
      .setDescription("Enable a rule")
      .addStringOption((o) =>
        o.setName("name").setDescription("Rule name").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("disable")
      .setDescription("Disable a rule")
      .addStringOption((o) =>
        o.setName("name").setDescription("Rule name").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Open the autoroles panel"),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") await handleCreate(interaction);
  else if (sub === "delete") await handleDelete(interaction);
  else if (sub === "list") await handleList(interaction);
  else if (sub === "enable") await handleToggle(interaction, true);
  else if (sub === "disable") await handleToggle(interaction, false);
  else if (sub === "panel") {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "autoroles");
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId!;
  const name = interaction.options.getString("name", true);
  const triggerType = interaction.options.getString("trigger", true) as AutoroleTrigger["type"];
  const role = interaction.options.getRole("role", true);

  let trigger: AutoroleTrigger;

  if (triggerType === "onJoin") {
    trigger = { type: "onJoin" };
  } else if (triggerType === "onReact") {
    const messageId = interaction.options.getString("message_id");
    const emoji = interaction.options.getString("emoji");
    if (!messageId || !emoji) {
      await interaction.editReply({
        content: "onReact requires both `message_id` and `emoji`.",
      });
      return;
    }
    trigger = { type: "onReact", messageId, emoji };
  } else {
    const keywordsStr = interaction.options.getString("keywords");
    if (!keywordsStr) {
      await interaction.editReply({ content: "messageContains requires `keywords`." });
      return;
    }
    const keywords = keywordsStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      await interaction.editReply({ content: "Provide at least one keyword." });
      return;
    }
    trigger = { type: "messageContains", keywords };
  }

  const result = await createRule({ guildId, name, trigger, roleId: role.id });

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription(`Could not create rule: ${result.error.message}`)],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Autorole Rule Created")
        .addFields(
          { name: "Name", value: name, inline: true },
          { name: "Trigger", value: triggerType, inline: true },
          { name: "Role", value: `<@&${role.id}>`, inline: true },
        ),
    ],
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId!;
  const name = interaction.options.getString("name", true);

  const result = await deleteRule(guildId, name);

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription(result.error.message)],
    });
    return;
  }

  if (!result.unwrap()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Yellow).setTitle("Not Found").setDescription(`No rule named **${name}** found.`)],
    });
    return;
  }

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(Colors.Green).setTitle("✅ Rule Deleted").setDescription(`Rule **${name}** has been removed.`)],
  });
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId!;
  const result = await listRules(guildId);

  if (result.isErr()) {
    await interaction.editReply({ content: "Failed to fetch rules." });
    return;
  }

  const rules = result.unwrap();

  if (rules.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle("Autorole Rules").setDescription("No rules configured yet. Use `/autorole create` to add one.")],
    });
    return;
  }

  const lines = rules.map((r) => {
    const status = r.enabled ? "✅" : "❌";
    const triggerDesc =
      r.trigger.type === "onJoin"
        ? "On Join"
        : r.trigger.type === "onReact"
          ? `On React (msg: ${r.trigger.messageId}, emoji: ${r.trigger.emoji})`
          : `Contains: ${r.trigger.keywords.join(", ")}`;
    return `${status} **${r.name}** — ${triggerDesc} → <@&${r.roleId}>`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("Autorole Rules")
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${rules.length} rule(s)` });

  await interaction.editReply({ embeds: [embed] });
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  enabled: boolean,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId!;
  const name = interaction.options.getString("name", true);

  const result = await setEnabled(guildId, name, enabled);

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription(result.error.message)],
    });
    return;
  }

  if (!result.unwrap()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Yellow).setTitle("Not Found").setDescription(`No rule named **${name}** found.`)],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(enabled ? Colors.Green : Colors.Grey)
        .setTitle(enabled ? "✅ Rule Enabled" : "⏸️ Rule Disabled")
        .setDescription(`Rule **${name}** is now ${enabled ? "active" : "paused"}.`),
    ],
  });
}

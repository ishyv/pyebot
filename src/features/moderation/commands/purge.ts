import {
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
  type Message,
  type TextChannel,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Bulk delete messages in the current channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addIntegerOption((o) =>
    o.setName("count").setDescription("Number of messages to delete (max 100)").setMinValue(1).setMaxValue(100).setRequired(true),
  )
  .addUserOption((o) => o.setName("user").setDescription("Only delete messages from this user"))
  .addStringOption((o) => o.setName("contains").setDescription("Only delete messages containing this text"))
  .addBooleanOption((o) => o.setName("bots").setDescription("Only delete bot messages"))
  .addBooleanOption((o) => o.setName("links").setDescription("Only delete messages containing links"))
  .addBooleanOption((o) => o.setName("attachments").setDescription("Only delete messages with attachments"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel?.isTextBased()) {
    await interaction.reply({ content: "This command can only be used in a server text channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const count = interaction.options.getInteger("count", true);
  const filterUser = interaction.options.getUser("user");
  const filterContains = interaction.options.getString("contains");
  const filterBots = interaction.options.getBoolean("bots") ?? false;
  const filterLinks = interaction.options.getBoolean("links") ?? false;
  const filterAttachments = interaction.options.getBoolean("attachments") ?? false;

  const channel = interaction.channel as TextChannel;

  let messages: Message[];
  try {
    const fetched = await channel.messages.fetch({ limit: 100 });
    messages = [...fetched.values()];
  } catch {
    await interaction.editReply({ content: "Failed to fetch messages." });
    return;
  }

  // Apply filters
  const filtered = messages.filter((m) => {
    if (filterUser && m.author.id !== filterUser.id) return false;
    if (filterBots && !m.author.bot) return false;
    if (filterContains && !m.content.toLowerCase().includes(filterContains.toLowerCase())) return false;
    if (filterLinks && !/https?:\/\//i.test(m.content)) return false;
    if (filterAttachments && m.attachments.size === 0) return false;
    return true;
  });

  // Discord bulk delete only works for messages < 14 days old
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  const deletable = filtered
    .filter((m) => Date.now() - m.createdTimestamp < TWO_WEEKS)
    .slice(0, count);

  if (deletable.length === 0) {
    await interaction.editReply({ content: "No messages matched the filters (or all are older than 14 days)." });
    return;
  }

  let deleted = 0;
  try {
    const result = await channel.bulkDelete(deletable, true);
    deleted = result.size;
  } catch {
    await interaction.editReply({ content: "Failed to delete messages. The bot may lack Manage Messages permission." });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle("Messages Purged")
    .addFields(
      { name: "Deleted", value: `${deleted}`, inline: true },
      { name: "Requested", value: `${count}`, inline: true },
      { name: "Channel", value: `<#${channel.id}>`, inline: true },
    )
    .setFooter({ text: `Purged by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

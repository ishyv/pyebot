import { type Message, PermissionFlagsBits, type TextChannel } from "discord.js";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("purge")
  .description("Bulk delete messages in the current channel")
  .integer("count", "Number of messages to delete (max 100)", { required: true, min: 1, max: 100 })
  .user("user", "Only delete messages from this user")
  .string("contains", "Only delete messages containing this text")
  .boolean("bots", "Only delete bot messages")
  .boolean("links", "Only delete messages containing links")
  .boolean("attachments", "Only delete messages with attachments")
  .defaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/mod help"] })
  .run(async ({ interaction, options }) => {
    if (!interaction.channel?.isTextBased()) {
      return { content: "This command can only be used in a server text channel." };
    }

    const channel = interaction.channel as TextChannel;
    const count = options.count;
    const filterUser = options.user;
    const filterContains = options.contains;
    const filterBots = options.bots ?? false;
    const filterLinks = options.links ?? false;
    const filterAttachments = options.attachments ?? false;

    let messages: Message[];
    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      messages = [...fetched.values()];
    } catch {
      return { content: "Failed to fetch messages." };
    }

    // Apply filters
    const filtered = messages.filter((m) => {
      if (filterUser && m.author.id !== filterUser.id) return false;
      if (filterBots && !m.author.bot) return false;
      if (filterContains && !m.content.toLowerCase().includes(filterContains.toLowerCase()))
        return false;
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
      return { content: "No messages matched the filters (or all are older than 14 days)." };
    }

    let deleted = 0;
    try {
      const result = await channel.bulkDelete(deletable, true);
      deleted = result.size;
    } catch {
      return { content: "Failed to delete messages. The bot may lack Manage Messages permission." };
    }

    return v2Message(
      container(
        "warn",
        text(
          `**${deleted} message${deleted === 1 ? "" : "s"} purged** from <#${channel.id}>\n` +
            `Requested: ${count} · By: <@${interaction.user.id}>`,
        ),
      ),
    );
  });

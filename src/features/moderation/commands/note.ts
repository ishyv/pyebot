import {
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { addNote, getNotes, deleteNote } from "@/features/moderation/service";

export const data = new SlashCommandBuilder()
  .setName("note")
  .setDescription("Manage private moderator notes on a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a note to a user")
      .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
      .addStringOption((o) => o.setName("note").setDescription("Note content").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List notes on a user")
      .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a note by its index")
      .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
      .addIntegerOption((o) => o.setName("index").setDescription("Note index (1-based)").setMinValue(1).setRequired(true)),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("user", true);
  const guildId = interaction.guild.id;

  if (sub === "add") {
    const note = interaction.options.getString("note", true);
    const result = await addNote(targetUser.id, guildId, note, interaction.user.id);
    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }
    await interaction.editReply({ content: `Note added for ${targetUser.tag}.` });
    return;
  }

  if (sub === "list") {
    const result = await getNotes(targetUser.id, guildId);
    if (result.isErr()) {
      await interaction.editReply({ content: "Failed to fetch notes." });
      return;
    }
    const notes = result.unwrap();
    if (notes.length === 0) {
      await interaction.editReply({ content: `No notes on **${targetUser.tag}**.` });
      return;
    }
    const description = notes
      .map((n, i) => {
        const ts = `<t:${Math.floor(new Date(n.createdAt).getTime() / 1000)}:d>`;
        return `**${i + 1}.** ${ts} by <@${n.moderatorId}>\n> ${n.note}`;
      })
      .join("\n\n");
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`Notes — ${targetUser.tag}`)
      .setDescription(description)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "delete") {
    const index = interaction.options.getInteger("index", true) - 1; // convert to 0-based
    const result = await deleteNote(targetUser.id, guildId, index);
    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }
    await interaction.editReply({ content: `Note ${index + 1} deleted.` });
  }
}

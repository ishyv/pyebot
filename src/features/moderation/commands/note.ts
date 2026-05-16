import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { addNote, deleteNote, getNotes } from "@/features/moderation/service";
import { renderNoteList } from "@/features/moderation/views";
import { defineCommand } from "@/framework";

const data = new SlashCommandBuilder()
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
      .addIntegerOption((o) =>
        o.setName("index").setDescription("Note index (1-based)").setMinValue(1).setRequired(true),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
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
    await interaction.editReply(renderNoteList(targetUser.tag, notes));
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

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

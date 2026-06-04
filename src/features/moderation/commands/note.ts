import { PermissionFlagsBits } from "discord.js";
import { addNote, deleteNote, getNotes } from "@/features/moderation/service";
import { renderNoteList } from "@/features/moderation/views";
import { command } from "@/framework";

export default command("note")
  .description("Manage private moderator notes on a user")
  .defaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .guildOnly()
  .defer("ephemeral")
  .subcommand({
    name: "add",
    description: "Add a note to a user",
    options: (s) =>
      s
        .user("user", "Target user", { required: true })
        .string("note", "Note content", { required: true }),
    run: async (c) => {
      const { user: targetUser, note } = c.options;
      const result = await addNote(targetUser.id, c.guildId, note, c.userId);
      if (result.isErr()) return { content: `Failed: ${result.error.message}` };
      return { content: `Note added for ${targetUser.tag}.` };
    },
  })
  .subcommand({
    name: "list",
    description: "List notes on a user",
    options: (s) => s.user("user", "Target user", { required: true }),
    run: async (c) => {
      const { user: targetUser } = c.options;
      const result = await getNotes(targetUser.id, c.guildId);
      if (result.isErr()) return { content: "Failed to fetch notes." };
      const notes = result.unwrap();
      if (notes.length === 0) return { content: `No notes on **${targetUser.tag}**.` };
      return renderNoteList(targetUser.tag, notes);
    },
  })
  .subcommand({
    name: "delete",
    description: "Delete a note by its index",
    options: (s) =>
      s
        .user("user", "Target user", { required: true })
        .integer("index", "Note index (1-based)", { required: true, min: 1 }),
    run: async (c) => {
      const { user: targetUser, index } = c.options;
      const result = await deleteNote(targetUser.id, c.guildId, index - 1); // convert to 0-based
      if (result.isErr()) return { content: `Failed: ${result.error.message}` };
      return { content: `Note ${index} deleted.` };
    },
  })
  .help({ hints: ["/cases"] });

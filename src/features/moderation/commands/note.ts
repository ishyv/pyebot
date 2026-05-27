import { PermissionFlagsBits } from "discord.js";
import { addNote, deleteNote, getNotes } from "@/features/moderation/service";
import { renderNoteList } from "@/features/moderation/views";
import { command } from "@/framework";

export default command("note")
  .description("Manage private moderator notes on a user")
  .defaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .guildOnly()
  .defer("ephemeral")
  .subcommand("add", "Add a note to a user", (s) =>
    s
      .user("user", "Target user", { required: true })
      .string("note", "Note content", { required: true }),
  )
  .subcommand("list", "List notes on a user", (s) =>
    s.user("user", "Target user", { required: true }),
  )
  .subcommand("delete", "Delete a note by its index", (s) =>
    s
      .user("user", "Target user", { required: true })
      .integer("index", "Note index (1-based)", { required: true, min: 1 }),
  )
  .help({ hints: ["/cases"] })
  .run(async (c) => {
    const { guildId, userId } = c;

    if (c.subcommand === "add") {
      const { user: targetUser, note } = c.options;
      const result = await addNote(targetUser.id, guildId, note, userId);
      if (result.isErr()) {
        return { content: `Failed: ${result.error.message}` };
      }
      return { content: `Note added for ${targetUser.tag}.` };
    }

    if (c.subcommand === "list") {
      const { user: targetUser } = c.options;
      const result = await getNotes(targetUser.id, guildId);
      if (result.isErr()) {
        return { content: "Failed to fetch notes." };
      }
      const notes = result.unwrap();
      if (notes.length === 0) {
        return { content: `No notes on **${targetUser.tag}**.` };
      }
      return renderNoteList(targetUser.tag, notes);
    }

    if (c.subcommand === "delete") {
      const { user: targetUser, index } = c.options;
      const zeroIndex = index - 1; // convert to 0-based
      const result = await deleteNote(targetUser.id, guildId, zeroIndex);
      if (result.isErr()) {
        return { content: `Failed: ${result.error.message}` };
      }
      return { content: `Note ${index} deleted.` };
    }
    return undefined;
  });

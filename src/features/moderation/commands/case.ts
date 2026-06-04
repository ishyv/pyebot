import { PermissionFlagsBits } from "discord.js";
import { deleteCase, editCase, getCaseById } from "@/features/moderation/service";
import { renderCaseView } from "@/features/moderation/views";
import { command } from "@/framework";

export default command("case")
  .description("Manage a specific moderation case")
  .defaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .guildOnly()
  .defer("ephemeral")
  .subcommand({
    name: "view",
    description: "View a case by its ID",
    options: (s) => s.integer("id", "Case ID", { required: true }),
    run: async (c) => {
      const { id: caseId } = c.options;
      const result = await getCaseById(c.guildId, caseId);
      if (result.isErr()) return { content: "Failed to look up case." };
      const found = result.unwrap();
      if (!found) return { content: `Case #${caseId} not found.` };
      return renderCaseView(found.entry, found.userId, caseId);
    },
  })
  .subcommand({
    name: "edit",
    description: "Edit the reason on a case",
    options: (s) =>
      s
        .integer("id", "Case ID", { required: true })
        .string("reason", "New reason", { required: true }),
    run: async (c) => {
      const { id: caseId, reason: newReason } = c.options;
      const found = await getCaseById(c.guildId, caseId);
      const foundEntry = found.isErr() ? null : found.unwrap();
      if (!foundEntry) return { content: `Case #${caseId} not found.` };
      const result = await editCase(foundEntry.userId, c.guildId, caseId, newReason);
      if (result.isErr()) return { content: `Failed: ${result.error.message}` };
      return { content: `Case #${caseId} reason updated.` };
    },
  })
  .subcommand({
    name: "delete",
    description: "Delete a case record",
    options: (s) => s.integer("id", "Case ID", { required: true }),
    run: async (c) => {
      const { id: caseId } = c.options;
      const found = await getCaseById(c.guildId, caseId);
      const foundEntry = found.isErr() ? null : found.unwrap();
      if (!foundEntry) return { content: `Case #${caseId} not found.` };
      const result = await deleteCase(foundEntry.userId, c.guildId, caseId);
      if (result.isErr()) return { content: `Failed: ${result.error.message}` };
      return { content: `Case #${caseId} deleted.` };
    },
  })
  .help({ hints: ["/cases"] });

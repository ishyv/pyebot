import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { deleteCase, editCase, getCaseById } from "@/features/moderation/service";
import { renderCaseView } from "@/features/moderation/views";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";

const data = new SlashCommandBuilder()
  .setName("case")
  .setDescription("Manage a specific moderation case")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View a case by its ID")
      .addIntegerOption((o) => o.setName("id").setDescription("Case ID").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit the reason on a case")
      .addIntegerOption((o) => o.setName("id").setDescription("Case ID").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("New reason").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a case record")
      .addIntegerOption((o) => o.setName("id").setDescription("Case ID").setRequired(true)),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await ctx.respond.send({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await ctx.respond.defer({ visibility: "ephemeral" });
  const sub = interaction.options.getSubcommand();
  const caseId = interaction.options.getInteger("id", true);

  if (sub === "view") {
    const result = await getCaseById(interaction.guild.id, caseId);
    if (result.isErr()) {
      await ctx.respond.send({ content: "Failed to look up case." });
      return;
    }
    const found = result.unwrap();
    if (!found) {
      await ctx.respond.send({ content: `Case #${caseId} not found.` });
      return;
    }
    await ctx.respond.send(renderCaseView(found.entry, found.userId, caseId));
    return;
  }

  if (sub === "edit") {
    const newReason = interaction.options.getString("reason", true);
    const found = await getCaseById(interaction.guild.id, caseId);
    if (found.isErr() || !found.unwrap()) {
      await ctx.respond.send({ content: `Case #${caseId} not found.` });
      return;
    }
    const result = await editCase(found.unwrap()!.userId, interaction.guild.id, caseId, newReason);
    if (result.isErr()) {
      await ctx.respond.send({ content: `Failed: ${result.error.message}` });
      return;
    }
    await ctx.respond.send({ content: `Case #${caseId} reason updated.` });
    return;
  }

  if (sub === "delete") {
    const found = await getCaseById(interaction.guild.id, caseId);
    if (found.isErr() || !found.unwrap()) {
      await ctx.respond.send({ content: `Case #${caseId} not found.` });
      return;
    }
    const result = await deleteCase(found.unwrap()!.userId, interaction.guild.id, caseId);
    if (result.isErr()) {
      await ctx.respond.send({ content: `Failed: ${result.error.message}` });
      return;
    }
    await ctx.respond.send({ content: `Case #${caseId} deleted.` });
  }
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

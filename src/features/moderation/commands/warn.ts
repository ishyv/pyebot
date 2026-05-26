import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { clearWarns, getCases, removeWarn, warn } from "@/features/moderation/service";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { hasPermission } from "@/middleware/permissions";
import { sendModLog } from "../modlog";
import { dmUser } from "../notifications";
import { renderModlogCase, renderSanctionHistory } from "../views";

const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Manage member warnings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Issue a warning to a member")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("Member to warn").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the warning").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List warnings for a member")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("Member to look up").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a specific warning by case ID")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("Member whose warning to remove").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("warn_id").setDescription("Case number").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Clear all warnings for a member")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("Member to clear warnings for").setRequired(true),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await ctx.respond.send({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("user", true);

  await ctx.respond.defer({ visibility: "ephemeral" });

  const callerMember = await interaction.guild.members.fetch(interaction.user.id);

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------
  if (subcommand === "add") {
    const reason = interaction.options.getString("reason", true);

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await ctx.respond.send({ content: "That user is not a member of this server." });
      return;
    }

    const result = await warn(interaction.guild, callerMember, targetMember, reason);

    if (result.isErr()) {
      await ctx.respond.send({ content: `Failed: ${result.error.message}` });
      return;
    }

    const sanctionResult = result.unwrap();

    await dmUser(targetMember.user, "WARN", interaction.guild.name, reason, sanctionResult.caseId);
    await sendModLog(interaction.guild, sanctionResult);

    await ctx.respond.send(renderModlogCase({ result: sanctionResult }));
    return;
  }

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  if (subcommand === "list") {
    const casesResult = await getCases(targetUser.id, interaction.guild.id);

    if (casesResult.isErr()) {
      await ctx.respond.send({
        content: `Failed to fetch cases: ${casesResult.error.message}`,
      });
      return;
    }

    const warns = casesResult
      .unwrap()
      .filter((e) => e.type === "WARN")
      .slice(0, 15);

    if (warns.length === 0) {
      await ctx.respond.send({ content: "No warnings on record." });
      return;
    }

    await ctx.respond.send(renderSanctionHistory(targetUser.tag, warns));
    return;
  }

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  if (subcommand === "remove") {
    if (!hasPermission(callerMember, PermissionFlagsBits.KickMembers)) {
      await ctx.respond.send({
        content: "You need the **Kick Members** permission to remove warnings.",
      });
      return;
    }

    const warnId = interaction.options.getString("warn_id", true);

    const result = await removeWarn(targetUser.id, interaction.guild.id, warnId);

    if (result.isErr()) {
      await ctx.respond.send({ content: `Failed: ${result.error.message}` });
      return;
    }

    if (!result.unwrap()) {
      await ctx.respond.send({ content: "No warning found with that ID." });
      return;
    }

    await ctx.respond.send({ content: `Warning #${warnId} removed.` });
    return;
  }

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------
  if (subcommand === "clear") {
    if (!hasPermission(callerMember, PermissionFlagsBits.KickMembers)) {
      await ctx.respond.send({
        content: "You need the **Kick Members** permission to clear warnings.",
      });
      return;
    }

    const result = await clearWarns(targetUser.id, interaction.guild.id);

    if (result.isErr()) {
      await ctx.respond.send({ content: `Failed: ${result.error.message}` });
      return;
    }

    const count = result.unwrap();
    await ctx.respond.send({
      content: `Cleared ${count} warning(s) for <@${targetUser.id}>.`,
    });
    return;
  }
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

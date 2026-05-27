import { PermissionFlagsBits } from "discord.js";
import { clearWarns, getCases, removeWarn, warn } from "@/features/moderation/service";
import { command } from "@/framework";
import { hasPermission } from "@/middleware/permissions";
import { sendModLog } from "../modlog";
import { dmUser } from "../notifications";
import { renderModlogCase, renderSanctionHistory } from "../views";

export default command("warn")
  .description("Manage member warnings")
  .defaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .guildOnly()
  .defer("ephemeral")
  .subcommand("add", "Issue a warning to a member", (s) =>
    s
      .user("user", "Member to warn", { required: true })
      .string("reason", "Reason for the warning", { required: true }),
  )
  .subcommand("list", "List warnings for a member", (s) =>
    s.user("user", "Member to look up", { required: true }),
  )
  .subcommand("remove", "Remove a specific warning by case ID", (s) =>
    s
      .user("user", "Member whose warning to remove", { required: true })
      .string("warn_id", "Case number", { required: true }),
  )
  .subcommand("clear", "Clear all warnings for a member", (s) =>
    s.user("user", "Member to clear warnings for", { required: true }),
  )
  .help({ hints: ["/cases"] })
  .run(async (c) => {
    const { guild, userId } = c;
    // All subcommands share the target user option (each sub defines its own)
    const targetUser = c.options.user;

    const callerMember = await guild.members.fetch(userId);

    if (c.subcommand === "add") {
      const { reason } = c.options;

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        return { content: "That user is not a member of this server." };
      }

      const result = await warn(guild, callerMember, targetMember, reason);
      if (result.isErr()) {
        return { content: `Failed: ${result.error.message}` };
      }

      const sanctionResult = result.unwrap();

      await dmUser(targetMember.user, "WARN", guild.name, reason, sanctionResult.caseId);
      await sendModLog(guild, sanctionResult);

      return renderModlogCase({ result: sanctionResult });
    }

    if (c.subcommand === "list") {
      const casesResult = await getCases(targetUser.id, guild.id);
      if (casesResult.isErr()) {
        return { content: `Failed to fetch cases: ${casesResult.error.message}` };
      }

      const warns = casesResult
        .unwrap()
        .filter((e) => e.type === "WARN")
        .slice(0, 15);

      if (warns.length === 0) {
        return { content: "No warnings on record." };
      }

      return renderSanctionHistory(targetUser.tag, warns);
    }

    if (c.subcommand === "remove") {
      if (!hasPermission(callerMember, PermissionFlagsBits.KickMembers)) {
        return { content: "You need the **Kick Members** permission to remove warnings." };
      }

      const { warn_id: warnId } = c.options;
      const result = await removeWarn(targetUser.id, guild.id, warnId);
      if (result.isErr()) {
        return { content: `Failed: ${result.error.message}` };
      }
      if (!result.unwrap()) {
        return { content: "No warning found with that ID." };
      }

      return { content: `Warning #${warnId} removed.` };
    }

    if (c.subcommand === "clear") {
      if (!hasPermission(callerMember, PermissionFlagsBits.KickMembers)) {
        return { content: "You need the **Kick Members** permission to clear warnings." };
      }

      const result = await clearWarns(targetUser.id, guild.id);
      if (result.isErr()) {
        return { content: `Failed: ${result.error.message}` };
      }

      const count = result.unwrap();
      return { content: `Cleared ${count} warning(s) for <@${targetUser.id}>.` };
    }
    return undefined;
  });

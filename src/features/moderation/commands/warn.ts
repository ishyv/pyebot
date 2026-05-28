import { PermissionFlagsBits } from "discord.js";
import { clearWarns, getCases, removeWarn, warn } from "@/features/moderation/service";
import { command } from "@/framework";
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
  .require("remove", PermissionFlagsBits.KickMembers)
  .require("clear", PermissionFlagsBits.KickMembers)
  .help({ hints: ["/cases"] })
  .handle("add", async (c) => {
    const { user: targetUser, reason } = c.options;
    const [callerMember, targetMember] = await Promise.all([
      c.guild.members.fetch(c.userId),
      c.guild.members.fetch(targetUser.id).catch(() => null),
    ]);
    if (!targetMember) return { content: "That user is not a member of this server." };
    const result = await warn(c.guild, callerMember, targetMember, reason);
    if (result.isErr()) return { content: `Failed: ${result.error.message}` };
    const sanctionResult = result.unwrap();
    await dmUser(targetMember.user, "WARN", c.guild.name, reason, sanctionResult.caseId);
    await sendModLog(c.guild, sanctionResult);
    return renderModlogCase({ result: sanctionResult });
  })
  .handle("list", async (c) => {
    const { user: targetUser } = c.options;
    const casesResult = await getCases(targetUser.id, c.guild.id);
    if (casesResult.isErr())
      return { content: `Failed to fetch cases: ${casesResult.error.message}` };
    const warns = casesResult
      .unwrap()
      .filter((e) => e.type === "WARN")
      .slice(0, 15);
    if (warns.length === 0) return { content: "No warnings on record." };
    return renderSanctionHistory(targetUser.tag, warns);
  })
  .handle("remove", async (c) => {
    const { user: targetUser, warn_id: warnId } = c.options;
    const result = await removeWarn(targetUser.id, c.guild.id, warnId);
    if (result.isErr()) return { content: `Failed: ${result.error.message}` };
    if (!result.unwrap()) return { content: "No warning found with that ID." };
    return { content: `Warning #${warnId} removed.` };
  })
  .handle("clear", async (c) => {
    const { user: targetUser } = c.options;
    const result = await clearWarns(targetUser.id, c.guild.id);
    if (result.isErr()) return { content: `Failed: ${result.error.message}` };
    const count = result.unwrap();
    return { content: `Cleared ${count} warning(s) for <@${targetUser.id}>.` };
  });

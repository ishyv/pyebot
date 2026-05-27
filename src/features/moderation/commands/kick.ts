import { PermissionFlagsBits } from "discord.js";
import { kick } from "@/features/moderation/service";
import { command } from "@/framework";
import { sendModLog } from "../modlog";
import { dmUser } from "../notifications";
import { renderModlogCase } from "../views";

export default command("kick")
  .description("Kick a member from the server")
  .user("user", "Member to kick", { required: true })
  .string("reason", "Reason for the kick", { required: true })
  .defaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/cases"] })
  .run(async ({ guild, user, options }) => {
    const targetUser = options.user;
    const reason = options.reason;

    const [moderator, targetMember] = await Promise.all([
      guild.members.fetch(user.id),
      guild.members.fetch(targetUser.id).catch(() => null),
    ]);

    if (!targetMember) {
      return { content: "That user is not a member of this server." };
    }

    const result = await kick(guild, moderator, targetMember, reason);

    if (result.isErr()) {
      return { content: `Failed: ${result.error.message}` };
    }

    const sanctionResult = result.unwrap();

    await dmUser(targetMember.user, "KICK", guild.name, reason, sanctionResult.caseId);
    await sendModLog(guild, sanctionResult);

    return renderModlogCase({ result: sanctionResult });
  });

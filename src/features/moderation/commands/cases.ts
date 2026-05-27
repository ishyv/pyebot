import { PermissionFlagsBits } from "discord.js";
import { getCases } from "@/features/moderation/service";
import { renderSanctionHistory } from "@/features/moderation/views";
import { command } from "@/framework";
import { hasPermission } from "@/middleware/permissions";
import { container, text, v2Message } from "@/ui/v2";

export default command("cases")
  .description("View the sanction history of a user on this server")
  .user("user", "User to look up (defaults to yourself)")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: [] })
  .run(async ({ guild, user, userId, options }) => {
    const targetUser = options.user ?? user;

    // Privacy gate: only allow viewing other users' history if caller has ModerateMembers
    if (targetUser.id !== userId) {
      const callerMember = await guild.members.fetch(userId).catch(() => null);
      if (!callerMember || !hasPermission(callerMember, PermissionFlagsBits.ModerateMembers)) {
        return v2Message(
          container(
            "danger",
            text("**Permission denied.** You can only view your own case history."),
          ),
        );
      }
    }

    const result = await getCases(targetUser.id, guild.id);

    if (result.isErr()) {
      return { content: "Failed to fetch case history." };
    }

    const history = result.unwrap();

    if (history.length === 0) {
      return { content: `**${targetUser.tag}** has no cases recorded on this server.` };
    }

    // Most recent first, cap at 15
    const entries = [...history].reverse().slice(0, 15);

    return renderSanctionHistory(targetUser.tag, entries);
  });

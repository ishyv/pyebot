import { PermissionFlagsBits } from "discord.js";
import { quarantine, release } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("quarantine")
  .description("Quarantine or release a member")
  .defaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .guildOnly()
  .defer("ephemeral")
  .subcommand("add", "Place a member in quarantine", (s) =>
    s
      .user("user", "Member to quarantine", { required: true })
      .string("reason", "Reason", { required: true }),
  )
  .subcommand("release", "Release a member from quarantine, restoring their roles", (s) =>
    s.user("user", "Member to release", { required: true }),
  )
  .help({ hints: ["/cases"] })
  .run(async (c) => {
    const { guild, userId } = c;

    const targetUser = c.options.user;
    const [moderator, targetMember] = await Promise.all([
      guild.members.fetch(userId),
      guild.members.fetch(targetUser.id).catch(() => null),
    ]);

    if (!targetMember) {
      return { content: "That user is not a member of this server." };
    }

    if (c.subcommand === "add") {
      const { reason } = c.options;
      const result = await quarantine(guild, moderator, targetMember, reason);
      if (result.isErr()) {
        return { content: `Failed: ${result.error.message}` };
      }
      return renderModlogCase({ result: result.unwrap() });
    }

    if (c.subcommand === "release") {
      const result = await release(guild, moderator, targetMember);
      if (result.isErr()) {
        return { content: `Failed: ${result.error.message}` };
      }
      const { restoredRoles } = result.unwrap();
      return v2Message(
        container(
          "ok",
          text(
            `**${targetUser.tag}** released from quarantine.\n**Roles restored:** ${restoredRoles}`,
          ),
        ),
      );
    }
    return undefined;
  });

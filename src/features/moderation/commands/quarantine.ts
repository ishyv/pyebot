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
  .subcommand({
    name: "add",
    description: "Place a member in quarantine",
    options: (s) =>
      s
        .user("user", "Member to quarantine", { required: true })
        .string("reason", "Reason", { required: true }),
    run: async (c) => {
      const { user: targetUser, reason } = c.options;
      const [moderator, targetMember] = await Promise.all([
        c.guild.members.fetch(c.userId),
        c.guild.members.fetch(targetUser.id).catch(() => null),
      ]);
      if (!targetMember) return { content: "That user is not a member of this server." };
      const result = await quarantine(c.ctx, c.guild, moderator, targetMember, reason);
      if (result.isErr()) return { content: `Failed: ${result.error.message}` };
      return renderModlogCase({ result: result.unwrap() });
    },
  })
  .subcommand({
    name: "release",
    description: "Release a member from quarantine, restoring their roles",
    options: (s) => s.user("user", "Member to release", { required: true }),
    run: async (c) => {
      const { user: targetUser } = c.options;
      const [moderator, targetMember] = await Promise.all([
        c.guild.members.fetch(c.userId),
        c.guild.members.fetch(targetUser.id).catch(() => null),
      ]);
      if (!targetMember) return { content: "That user is not a member of this server." };
      const result = await release(c.ctx, c.guild, moderator, targetMember);
      if (result.isErr()) return { content: `Failed: ${result.error.message}` };
      const { restoredRoles } = result.unwrap();
      return v2Message(
        container(
          "ok",
          text(
            `**${targetUser.tag}** released from quarantine.\n**Roles restored:** ${restoredRoles}`,
          ),
        ),
      );
    },
  })
  .help({ hints: ["/cases"] });

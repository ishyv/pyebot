import { PermissionFlagsBits } from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { restrict } from "@/features/moderation/service";
import { command } from "@/framework";
import { sendModLog } from "../modlog";
import { dmUser } from "../notifications";
import { renderModlogCase } from "../views";

export default command("restrict")
  .description("Restrict a member from specific server areas")
  .user("user", "Member to restrict", { required: true })
  .string("type", "Area to restrict from", {
    required: true,
    choices: [
      { name: "Forums", value: "forums" },
      { name: "Voice", value: "voice" },
      { name: "Jobs", value: "jobs" },
      { name: "All areas", value: "all" },
    ],
  })
  .string("reason", "Reason for restriction")
  .defaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/cases"] })
  .run(async ({ ctx, guild, userId, options }) => {
    const targetUser = options.user;
    const type = options.type as "forums" | "voice" | "jobs" | "all";
    const reason = options.reason ?? "No reason provided";

    const guildResult = await getGuild(guild.id);
    if (guildResult.isErr()) {
      return { content: "Failed to load guild configuration." };
    }

    const guildData = guildResult.unwrap();
    const roleId = guildData?.moderation.restrictionRoles[type] ?? null;

    if (!roleId) {
      return {
        content:
          "Restriction roles are not configured. Use `/modconfig restrict-roles` to set them up.",
      };
    }

    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      return {
        content:
          "The configured restriction role no longer exists. Please reconfigure it with `/modconfig restrict-roles`.",
      };
    }

    // Check role hierarchy — bot's highest role must be above the restriction role
    const botMember = guild.members.me;
    if (!botMember) {
      return { content: "Unable to determine bot permissions." };
    }
    if (botMember.roles.highest.position <= role.position) {
      return { content: "Cannot assign a role higher than or equal to the bot's highest role." };
    }

    const [moderator, targetMember] = await Promise.all([
      guild.members.fetch(userId).catch(() => null),
      guild.members.fetch(targetUser.id).catch(() => null),
    ]);

    if (!moderator) {
      return { content: "Unable to verify your server membership." };
    }
    if (!targetMember) {
      return { content: "That user is not a member of this server." };
    }

    const result = await restrict(ctx, guild, moderator, targetMember, roleId, reason);

    if (result.isErr()) {
      return { content: `Failed: ${result.error.message}` };
    }

    const sanctionResult = result.unwrap();

    await dmUser(targetMember.user, "RESTRICT", guild.name, reason, sanctionResult.caseId);
    await sendModLog(guild, sanctionResult, { restrictionType: type });

    return renderModlogCase({ result: sanctionResult, extras: { restrictionType: type } });
  });

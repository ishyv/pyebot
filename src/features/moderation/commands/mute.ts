import { PermissionFlagsBits } from "discord.js";
import { sendModLog } from "@/features/moderation/modlog";
import { dmUser } from "@/features/moderation/notifications";
import { mute } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { parseDuration } from "@/utils/duration";
import { msToHuman } from "@/utils/time";

export default command("mute")
  .description("Timeout (mute) a member")
  .user("user", "Member to mute", { required: true })
  .string("duration", "Duration (e.g. 10m, 2h, 1d, 7d, 1w — max 28d)", { required: true })
  .string("reason", "Reason for the mute", { required: true })
  .defaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/cases"] })
  .run(async ({ ctx, guild, user, options }) => {
    const targetUser = options.user;
    const reason = options.reason;

    const durationMs = parseDuration(options.duration);
    if (durationMs === null) {
      return v2Message(
        container(
          "danger",
          text(
            "**Invalid duration.** Valid formats: `10s`, `5m`, `2h`, `3d`, `1w` — maximum 28 days.",
          ),
        ),
      );
    }

    const [moderator, targetMember] = await Promise.all([
      guild.members.fetch(user.id),
      guild.members.fetch(targetUser.id).catch(() => null),
    ]);

    if (!targetMember) {
      return { content: "That user is not a member of this server." };
    }

    const result = await mute(ctx, guild, moderator, targetMember, durationMs, reason);

    if (result.isErr()) {
      return { content: `Failed: ${result.error.message}` };
    }

    const modResult = result.unwrap();
    const humanDuration = msToHuman(durationMs);

    await Promise.all([
      dmUser(targetMember.user, "TIMEOUT", guild.name, reason, modResult.caseId),
      sendModLog(guild, modResult, { duration: humanDuration }),
    ]);

    return renderModlogCase({ result: modResult, extras: { duration: humanDuration } });
  });

import { PermissionFlagsBits } from "discord.js";
import { ban, TEMP_BAN_DURATION_CHOICES } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { command } from "@/framework";

export default command("ban")
  .description("Ban a user from the server")
  .user("user", "User to ban", { required: true })
  .string("reason", "Reason for the ban", { required: true })
  .string("duration", "Temporary ban duration (omit for permanent)", {
    choices: TEMP_BAN_DURATION_CHOICES.map((d) => ({ name: d, value: d })),
  })
  .defaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/cases"] })
  .run(async ({ guild, user, options }) => {
    const target = options.user;
    const reason = options.reason;
    const duration = options.duration ?? undefined;
    const moderator = await guild.members.fetch(user.id);

    const result = await ban(guild, moderator, target, reason, duration);

    if (result.isErr()) {
      return { content: `Failed: ${result.error.message}` };
    }

    const modResult = result.unwrap();
    return renderModlogCase({ result: modResult, extras: duration ? { duration } : undefined });
  });

import { PermissionFlagsBits } from "discord.js";
import { unban } from "@/features/moderation/service";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { sendModLog } from "../modlog";
import { renderModlogCase } from "../views";

export default command("unban")
  .description("Unban a user from this server")
  .defaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .string("user_id", "Discord user ID of the banned user", { required: true })
  .string("reason", "Reason for unbanning")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/cases"] })
  .run(async ({ ctx, guild, user, options }) => {
    const userId = options.user_id.trim();
    const reason = options.reason ?? "No reason provided";

    if (!/^\d{17,19}$/.test(userId)) {
      return v2Message(
        container(
          "danger",
          text("**Invalid user ID.** Please provide a valid Discord snowflake (17–19 digits)."),
        ),
      );
    }

    try {
      await guild.bans.fetch(userId);
    } catch {
      return v2Message(container("danger", text("That user is not currently banned.")));
    }

    const moderator = await guild.members.fetch(user.id);

    const targetUser = await guild.client.users.fetch(userId).catch(() => null);
    const result = await unban(ctx, guild, moderator, userId, reason, targetUser?.tag);

    if (result.isErr()) {
      return v2Message(container("danger", text(`**Failed:** ${result.error.message}`)));
    }

    const sanctionResult = result.unwrap();

    await sendModLog(guild, sanctionResult);

    return renderModlogCase({ result: sanctionResult });
  });

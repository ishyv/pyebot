import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { sendModLog } from "@/features/moderation/modlog";
import { dmUser } from "@/features/moderation/notifications";
import { mute } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { parseDuration } from "@/utils/duration";
import { msToHuman } from "@/utils/time";

const data = new SlashCommandBuilder()
  .setName("mute")
  .setDescription("Timeout (mute) a member")
  .addUserOption((opt) => opt.setName("user").setDescription("Member to mute").setRequired(true))
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Duration (e.g. 10m, 2h, 1d, 7d, 1w — max 28d)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the mute").setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await ctx.respond.send({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const durationStr = interaction.options.getString("duration", true);
  const reason = interaction.options.getString("reason", true);

  await ctx.respond.defer({ visibility: "ephemeral" });

  const durationMs = parseDuration(durationStr);
  if (durationMs === null) {
    await ctx.respond.send(
      v2Message(
        container(
          "danger",
          text(
            "**Invalid duration.** Valid formats: `10s`, `5m`, `2h`, `3d`, `1w` — maximum 28 days.",
          ),
        ),
      ),
    );
    return;
  }

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await ctx.respond.send({ content: "That user is not a member of this server." });
    return;
  }

  const result = await mute(interaction.guild, moderator, targetMember, durationMs, reason);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Failed: ${result.error.message}` });
    return;
  }

  const modResult = result.unwrap();
  const humanDuration = msToHuman(durationMs);

  await Promise.all([
    dmUser(targetMember.user, "TIMEOUT", interaction.guild.name, reason, modResult.caseId),
    sendModLog(interaction.guild, modResult, { duration: humanDuration }),
  ]);

  await ctx.respond.send(
    renderModlogCase({ result: modResult, extras: { duration: humanDuration } }),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/cases"] },
  execute,
});

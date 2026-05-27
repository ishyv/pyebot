import { type ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { unban } from "@/features/moderation/service";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { sendModLog } from "../modlog";
import { renderModlogCase } from "../views";

const data = command("unban")
  .setDescription("Unban a user from this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt.setName("user_id").setDescription("Discord user ID of the banned user").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for unbanning").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild || !interaction.member) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.options.getString("user_id", true).trim();
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!/^\d{17,19}$/.test(userId)) {
    await ctx.respond.send(
      v2Message(
        container(
          "danger",
          text("**Invalid user ID.** Please provide a valid Discord snowflake (17–19 digits)."),
        ),
      ),
    );
    return;
  }

  try {
    await interaction.guild.bans.fetch(userId);
  } catch {
    await ctx.respond.send(
      v2Message(container("danger", text("That user is not currently banned."))),
    );
    return;
  }

  const moderator = await interaction.guild.members.fetch(interaction.user.id);

  const targetUser = await interaction.guild.client.users.fetch(userId).catch(() => null);
  const result = await unban(interaction.guild, moderator, userId, reason, targetUser?.tag);

  if (result.isErr()) {
    await ctx.respond.send(
      v2Message(container("danger", text(`**Failed:** ${result.error.message}`))),
    );
    return;
  }

  const sanctionResult = result.unwrap();

  await sendModLog(interaction.guild, sanctionResult);

  await ctx.respond.send(renderModlogCase({ result: sanctionResult }));
}

export default data
  .help({ hints: ["/cases"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

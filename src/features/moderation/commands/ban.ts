import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { ban, TEMP_BAN_DURATION_CHOICES } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";

const data = command("ban")
  .setDescription("Ban a user from the server")
  .addUserOption((opt) => opt.setName("user").setDescription("User to ban").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the ban").setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Temporary ban duration (omit for permanent)")
      .addChoices(...TEMP_BAN_DURATION_CHOICES.map((d) => ({ name: d, value: d }))),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await ctx.respond.send({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);
  const duration = interaction.options.getString("duration") ?? undefined;
  const moderator = await interaction.guild.members.fetch(interaction.user.id);

  await ctx.respond.defer({ visibility: "ephemeral" });

  const result = await ban(interaction.guild, moderator, target, reason, duration);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Failed: ${result.error.message}` });
    return;
  }

  const modResult = result.unwrap();
  await ctx.respond.send(
    renderModlogCase({ result: modResult, extras: duration ? { duration } : undefined }),
  );
}

export default data
  .help({ hints: ["/cases"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

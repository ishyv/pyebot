import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { quarantine, release } from "@/features/moderation/service";
import { renderModlogCase } from "@/features/moderation/views";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = command("quarantine")
  .setDescription("Quarantine or release a member")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Place a member in quarantine")
      .addUserOption((o) =>
        o.setName("user").setDescription("Member to quarantine").setRequired(true),
      )
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("release")
      .setDescription("Release a member from quarantine, restoring their roles")
      .addUserOption((o) =>
        o.setName("user").setDescription("Member to release").setRequired(true),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await ctx.respond.send({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await ctx.respond.defer({ visibility: "ephemeral" });
  const sub = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("user", true);

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await ctx.respond.send({ content: "That user is not a member of this server." });
    return;
  }

  if (sub === "add") {
    const reason = interaction.options.getString("reason", true);
    const result = await quarantine(interaction.guild, moderator, targetMember, reason);

    if (result.isErr()) {
      await ctx.respond.send({ content: `Failed: ${result.error.message}` });
      return;
    }

    await ctx.respond.send(renderModlogCase({ result: result.unwrap() }));
    return;
  }

  if (sub === "release") {
    const result = await release(interaction.guild, moderator, targetMember);

    if (result.isErr()) {
      await ctx.respond.send({ content: `Failed: ${result.error.message}` });
      return;
    }

    const { restoredRoles } = result.unwrap();
    await ctx.respond.send(
      v2Message(
        container(
          "ok",
          text(
            `**${targetUser.tag}** released from quarantine.\n**Roles restored:** ${restoredRoles}`,
          ),
        ),
      ),
    );
  }
}

export default data
  .help({ hints: ["/cases"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

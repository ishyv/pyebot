import { ButtonBuilder, ButtonStyle, type ChatInputCommandInteraction } from "discord.js";
import { initiateFight } from "@/features/rpg/combat/fight";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, section, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = command("fight")
  .setDescription("Challenge another user to a fight")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to challenge").setRequired(true),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer();

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const userId = interaction.user.id;

  if (target.id === userId) {
    await ctx.respond.send({ content: "You cannot challenge yourself to a fight." });
    return;
  }

  const result = await initiateFight(ctx, userId, target.id);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Error: ${result.error.message}` });
    return;
  }

  const { sessionId, expiresAt } = result.unwrap();
  const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);

  const acceptButton = new ButtonBuilder()
    .setCustomId(`fight_accept:${sessionId}`)
    .setLabel("Accept")
    .setStyle(ButtonStyle.Success);

  await ctx.respond.send(
    v2Message(
      container(
        "danger",
        section(
          `## Fight Invitation Sent!\nFight invitation sent to <@${target.id}>!\n\nExpires <t:${expiryTimestamp}:R>\n\n-# ${getHints("fight")}`,
          acceptButton,
        ),
      ),
    ),
  );
}

export default data
  .help({ hints: ["/rpg-profile", "/rpg-quest list", "/inventory"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

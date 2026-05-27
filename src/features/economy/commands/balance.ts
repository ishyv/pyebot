import type { ChatInputCommandInteraction } from "discord.js";
import { UserCurrency } from "@/components/user-currency";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, section, thumb, v2Message } from "@/ui/v2";

const data = command("balance")
  .setDescription("Check a user's coin balance")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to check (defaults to you)").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const wallet = await ctx.get(target.id, UserCurrency);
  const balance = wallet?.balances["coins"] ?? 0;

  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        section(
          `## ${target.username}'s Balance\n**${balance} coins**`,
          thumb(target.displayAvatarURL(), "avatar"),
        ),
      ),
    ),
  );
}

export default data
  .help({ hints: ["/work", "/transfer"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

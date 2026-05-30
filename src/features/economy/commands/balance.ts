import { UserCurrency } from "@/components/user-currency";
import { command } from "@/framework";
import { container, section, thumb, v2Message } from "@/ui/v2";

export default command("balance")
  .description("Check a user's coin balance")
  .user("user", "User to check (defaults to you)")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/work", "/transfer"] })
  .run(async ({ ctx, user, options }) => {
    const target = options.user ?? user;
    const wallet = await ctx.get(target.id, UserCurrency);
    const balance = wallet?.balances.coins ?? 0;

    return v2Message(
      container(
        "ok",
        section(
          `## ${target.username}'s Balance\n**${balance} coins**`,
          thumb(target.displayAvatarURL(), "avatar"),
        ),
      ),
    );
  });

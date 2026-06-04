import { ButtonStyle } from "discord.js";
import { initiateFight } from "@/features/rpg/combat/fight";
import { fightRoutes } from "@/features/rpg/routes";
import { command } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

export default command("fight")
  .description("Challenge another user to a fight")
  .user("user", "The user to challenge", { required: true })
  .guildOnly()
  .defer("public")
  .help({ hints: ["/rpg-profile", "/rpg-quest list", "/inventory"] })
  .run(async ({ ctx, userId, options }) => {
    const target = options.user;

    if (target.id === userId) {
      return { content: "You cannot challenge yourself to a fight." };
    }

    const result = await initiateFight(ctx, userId, target.id);

    if (result.isErr()) {
      return { content: `Error: ${result.error.message}` };
    }

    const { sessionId, expiresAt } = result.unwrap();
    const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);

    const acceptButton = fightRoutes.accept.button(
      { session: sessionId },
      { label: "Accept", style: ButtonStyle.Success },
    );

    return v2Message(
      container(
        "danger",
        section(
          `## Fight Invitation Sent!\nFight invitation sent to <@${target.id}>!\n\nExpires <t:${expiryTimestamp}:R>\n\n-# ${getHints("fight")}`,
          acceptButton,
        ),
      ),
    );
  });

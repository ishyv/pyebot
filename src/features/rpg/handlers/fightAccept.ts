/**
 * Fight accept button handler.
 *
 * Purpose: Handle button interactions with customId `fight_accept:{sessionId}`.
 * Calls acceptFight() and transitions session to active, then shows combat move buttons.
 */

import type { ButtonInteraction } from "discord.js";
import { acceptFight, getFightSession } from "@/features/rpg/combat/fight";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
import { moveButtons } from "./combatMove";

export async function handleFightAccept(
  interaction: ButtonInteraction,
  { session: sessionId }: { session: string },
  ctx: Ctx,
): Promise<void> {
  const accepterId = interaction.user.id;

  await interaction.deferReply();

  const result = await acceptFight(ctx, sessionId, accepterId);

  if (result.isErr()) {
    await interaction.editReply({ content: `Cannot accept fight: ${result.error.message}` });
    return;
  }

  const session = getFightSession(sessionId);
  if (!session) {
    await interaction.editReply({ content: "Fight session not found." });
    return;
  }

  // Build move buttons for both players
  const moveRow = moveButtons(sessionId);

  await interaction.editReply({
    ...v2Message(
      container(
        "danger",
        text(`## Fight Started!\n<@${session.p1Id}> vs <@${session.p2Id}>`),
        separator("sm"),
        text(
          `**Round ${session.currentRound}** — Both players must choose a move.\n` +
            `HP: <@${session.p1Id}> **${session.p1Hp}/${session.p1MaxHp}** | <@${session.p2Id}> **${session.p2Hp}/${session.p2MaxHp}**`,
        ),
      ),
    ),
    components: [moveRow],
  });
}

/**
 * Combat move button handler.
 *
 * Purpose: Handle button interactions with customId `fight_move:{sessionId}:{move}`.
 * Calls submitMove(). When both players have moved, resolves the round and shows results.
 * If combat ends, shows the winner.
 */

import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { getFightSession, submitMove } from "@/features/rpg/combat/fight";
import { fightRoutes } from "@/features/rpg/routes";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";

/** The Attack / Block action row for a round, shared by fight-accept and -move. */
export function moveButtons(sessionId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    fightRoutes.move.button(
      { session: sessionId, move: "attack" },
      { label: "⚔️ Attack", style: ButtonStyle.Danger },
    ),
    fightRoutes.move.button(
      { session: sessionId, move: "block" },
      { label: "🛡️ Block", style: ButtonStyle.Primary },
    ),
  );
}

export async function handleCombatMove(
  interaction: ButtonInteraction,
  { session: sessionId, move }: { session: string; move: "attack" | "block" },
  ctx: Ctx,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await submitMove(ctx, sessionId, interaction.user.id, move);

  if (result.isErr()) {
    await interaction.editReply({ content: `Move error: ${result.error.message}` });
    return;
  }

  const data = result.unwrap();

  if (!data.roundResolved) {
    await interaction.editReply({ content: `Move **${move}** submitted. Waiting for opponent...` });
    return;
  }

  // Round resolved — build round summary
  const round = data.round;
  if (!round) {
    await interaction.editReply({ content: "Combat round resolved without round data." });
    return;
  }
  const session = getFightSession(sessionId);

  if (data.combatEnded && data.combatResult) {
    const { winnerId, loserId, totalRounds } = data.combatResult;

    // Edit the original fight message to remove buttons
    try {
      await interaction.message.edit({ components: [] });
    } catch {
      // Original message may be gone
    }

    await interaction.editReply(
      v2Message(
        container(
          "ok",
          text(
            `## Combat Ended!\n**Winner:** <@${winnerId}> 🏆\n**Loser:** <@${loserId}>\n**Total Rounds:** ${totalRounds}`,
          ),
          separator("sm"),
          text(
            `**Final HP**\nWinner: ${data.combatResult.finalHp.winner} | Loser: ${data.combatResult.finalHp.loser}`,
          ),
        ),
      ),
    );
    return;
  }

  // Show round result and next round buttons
  const moveRow = moveButtons(sessionId);

  const roundSummary = v2Message(
    container(
      "warn",
      text(
        `## Round ${round.roundNumber} Results\n` +
          `<@${session?.p1Id}> used **${round.p1Move}** — took **${round.p1Damage}** damage (${session?.p1Hp}/${session?.p1MaxHp} HP)\n` +
          `<@${session?.p2Id}> used **${round.p2Move}** — took **${round.p2Damage}** damage (${session?.p2Hp}/${session?.p2MaxHp} HP)\n\n` +
          `-# Round ${session?.currentRound ?? round.roundNumber + 1} — choose your next move`,
      ),
    ),
  );

  try {
    await interaction.message.edit({ ...roundSummary, components: [moveRow] });
  } catch {
    // Fall back to ephemeral reply
  }

  await interaction.editReply({ content: `Round ${round.roundNumber} resolved.` });
}

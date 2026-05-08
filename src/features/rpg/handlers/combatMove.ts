/**
 * Combat move button handler.
 *
 * Purpose: Handle button interactions with customId `fight_move:{sessionId}:{move}`.
 * Calls submitMove(). When both players have moved, resolves the round and shows results.
 * If combat ends, shows the winner.
 */

import {
  MessageFlags,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import { submitMove, getFightSession } from "@/features/rpg/combat/fight";
import type { CombatMove } from "@/features/rpg/combat/engine";

export const FIGHT_MOVE_PREFIX = "fight_move:";

export function isFightMoveButton(customId: string): boolean {
  return customId.startsWith(FIGHT_MOVE_PREFIX);
}

export async function handleCombatMove(interaction: ButtonInteraction): Promise<void> {
  // customId: "fight_move:{sessionId}:{move}"
  const rest = interaction.customId.slice(FIGHT_MOVE_PREFIX.length);
  const lastColon = rest.lastIndexOf(":");
  const sessionId = rest.slice(0, lastColon);
  const move = rest.slice(lastColon + 1) as CombatMove;

  if (!sessionId || (move !== "attack" && move !== "block")) {
    await interaction.reply({ content: "Invalid move button.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await submitMove(sessionId, interaction.user.id, move as "attack" | "block");

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
  const round = data.round!;
  const session = getFightSession(sessionId);

  if (data.combatEnded && data.combatResult) {
    const { winnerId, loserId, totalRounds } = data.combatResult;
    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle("Combat Ended!")
      .setDescription(
        `**Winner:** <@${winnerId}> 🏆\n` +
        `**Loser:** <@${loserId}>\n` +
        `**Total Rounds:** ${totalRounds}`,
      )
      .addFields(
        { name: "Final HP", value: `Winner: ${data.combatResult.finalHp.winner} | Loser: ${data.combatResult.finalHp.loser}`, inline: false },
      )
      .setTimestamp();

    // Edit the original fight message to remove buttons
    try {
      await interaction.message.edit({ components: [] });
    } catch {
      // Original message may be gone
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Show round result and next round buttons
  const moveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`fight_move:${sessionId}:attack`)
      .setLabel("⚔️ Attack")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`fight_move:${sessionId}:block`)
      .setLabel("🛡️ Block")
      .setStyle(ButtonStyle.Primary),
  );

  const roundEmbed = new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle(`Round ${round.roundNumber} Results`)
    .setDescription(
      `<@${session?.p1Id}> used **${round.p1Move}** — took **${round.p1Damage}** damage (${session?.p1Hp}/${session?.p1MaxHp} HP)\n` +
      `<@${session?.p2Id}> used **${round.p2Move}** — took **${round.p2Damage}** damage (${session?.p2Hp}/${session?.p2MaxHp} HP)`,
    )
    .setFooter({ text: `Round ${(session?.currentRound ?? round.roundNumber + 1)} — choose your next move` })
    .setTimestamp();

  try {
    await interaction.message.edit({ embeds: [roundEmbed], components: [moveRow] });
  } catch {
    // Fall back to ephemeral reply
  }

  await interaction.editReply({ content: `Round ${round.roundNumber} resolved.` });
}

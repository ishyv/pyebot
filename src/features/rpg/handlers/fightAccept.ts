/**
 * Fight accept button handler.
 *
 * Purpose: Handle button interactions with customId `fight_accept:{sessionId}`.
 * Calls acceptFight() and transitions session to active, then shows combat move buttons.
 */

import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle } from "discord.js";
import { acceptFight, getFightSession } from "@/features/rpg/combat/fight";
import { container, separator, text, v2Message } from "@/ui/v2";

export const FIGHT_ACCEPT_PREFIX = "fight_accept:";

export function isFightAcceptButton(customId: string): boolean {
  return customId.startsWith(FIGHT_ACCEPT_PREFIX);
}

export async function handleFightAccept(interaction: ButtonInteraction): Promise<void> {
  const sessionId = interaction.customId.slice(FIGHT_ACCEPT_PREFIX.length);
  const accepterId = interaction.user.id;

  await interaction.deferReply();

  const result = await acceptFight(sessionId, accepterId);

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

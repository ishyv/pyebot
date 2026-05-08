import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";
import { getExpeditionSession, updateExpeditionSession, endExpedition } from "@/features/rpg/expedition";
import { patchRpgProfile, getRpgProfile } from "@/db/repositories/rpg";

export function isExpeditionButton(id: string): boolean {
  return id.startsWith("expedition_push:") || id.startsWith("expedition_extract:");
}

// ── Location data ──────────────────────────────────────────────────────────
const LOCATION_META: Record<string, { name: string; icon: string; color: number }> = {
  woods: { name: "The Whispering Woods", icon: "🌲", color: 0x1e3a2f },
  mines: { name: "The Deep Mines",       icon: "⛏️", color: 0x1a1a2e },
};

// ── Randomised flavour lines ───────────────────────────────────────────────
const PUSH_EVENTS: Record<string, string[]> = {
  woods: [
    "You push further into the canopy. Something large shifts in the branches overhead.",
    "The root network hums beneath your feet. The trees know you're here.",
    "You find a clearing. Something was feeding here recently. The bones are still wet.",
    "The whisper increases in volume. It sounds almost like a name. Not yours.",
    "Thornvines close behind you as you advance. The path back is already harder to find.",
  ],
  mines: [
    "The shaft descends another 20 feet. The temperature drops. Ore glints in the lantern light.",
    "A grinding sound from the tunnel to your left. It stops when you stop. You keep moving.",
    "The walls here are wet. Something other than water slicks the stone.",
    "Deeper. The essence concentration is visible now — faint veins of light in the rock face.",
    "Your lantern flickers without a draft. You check the flame. It's fine. Probably fine.",
  ],
};

const EXTRACT_SUCCESS: string[] = [
  "You emerge into grey light, lungs burning, pack heavy. The walls have never looked so welcoming.",
  "You make it out. The gate warden makes a mark in his ledger. You don't ask what it means.",
  "Out. Alive. The loot is heavy on your back. You don't look behind you.",
  "Daylight. Actual daylight, filtered and grey, but real. You made the right call.",
];

const DEATH_LINES: string[] = [
  "The cold finds you before the dark does. Your gear scatters across the floor. Someone else will find it. Someone always does.",
  "The last thing you see is the ceiling. It looks like every other ceiling you've seen today.",
  "You overextended. The wilderness doesn't grade on effort.",
  "Dead. Your equipped gear is forfeit. The raid remembers nothing.",
];

const BLEED_LINES: string[] = [
  `You took too much damage and collapsed before you could extract. Your gear stays behind.`,
  `Blood loss. Consciousness left first, then everything else. Your kit is gone.`,
];

function hpBarStr(current: number, max: number, length = 10): string {
  const pct = Math.max(0, current / max);
  const filled = Math.round(pct * length);
  const empty = length - filled;
  const color = current > 60 ? "🟩" : current > 25 ? "🟨" : "🟥";
  return `${color} \`${"█".repeat(filled)}${"░".repeat(empty)}\``;
}

function lootSummary(loot: Record<string, number>): string {
  if (Object.keys(loot).length === 0) return "*Nothing. You came out with what you went in with.*";
  return Object.entries(loot)
    .map(([id, qty]) => `**${qty}×** ${id.replace(/_/g, " ")}`)
    .join("\n");
}

export async function handleExpeditionButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const [action, sessionId] = interaction.customId.split(":");
  const session = getExpeditionSession(sessionId!);

  if (!session) {
    await interaction.editReply({ content: "This expedition session has expired.", components: [] });
    return;
  }

  if (session.userId !== interaction.user.id) {
    await interaction.followUp({ content: "This is not your expedition.", flags: MessageFlags.Ephemeral });
    return;
  }

  const loc = LOCATION_META[session.location] ?? LOCATION_META["woods"]!;

  // ── EXTRACT ──────────────────────────────────────────────────────────────
  if (action === "expedition_extract") {
    const endRes = await endExpedition(interaction.user.id, "extract", session.id);
    if (endRes.isErr()) {
      await interaction.editReply({ content: endRes.error.message, components: [] });
      return;
    }

    const quote = EXTRACT_SUCCESS[Math.floor(Math.random() * EXTRACT_SUCCESS.length)]!;
    const loot = lootSummary(session.loot);

    const embed = new EmbedBuilder()
      .setColor(0x1a3a1a)
      .setTitle(`${loc.icon} Extracted — ${loc.name}`)
      .setDescription(
        `*${quote}*\n\n` +
        `**Loot Secured:**\n${loot}\n\n` +
        `*Survived ${session.eventsSurvived} event${session.eventsSurvived !== 1 ? "s" : ""}.*`
      )
      .setFooter({ text: `Ashenmoor · Expeditions · ${interaction.user.username}` });

    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  // ── PUSH ─────────────────────────────────────────────────────────────────
  if (action === "expedition_push") {
    const deathChance = 0.20 + (session.eventsSurvived * 0.05);
    const rng = Math.random();

    const profileRes = await getRpgProfile(interaction.user.id);
    if (profileRes.isErr() || !profileRes.unwrap()) return;
    const profile = profileRes.unwrap()!;

    // Rolled death
    if (rng < deathChance) {
      await endExpedition(interaction.user.id, "die", session.id);

      const deathLine = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)]!;
      const embed = new EmbedBuilder()
        .setColor(0x3a0a0a)
        .setTitle(`💀 ${interaction.user.username} — Dead`)
        .setDescription(
          `*${deathLine}*\n\n` +
          `**Loot Lost:** all gathered materials abandoned\n` +
          `**Gear Lost:** all equipped items stripped\n\n` +
          `*Survived ${session.eventsSurvived} event${session.eventsSurvived !== 1 ? "s" : ""} before the end.*`
        )
        .setFooter({ text: `Ashenmoor · The price of greed · /hideout heal to recover` });

      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // Survived — take damage
    const dmg = Math.floor(Math.random() * 20) + 10;
    const newHp = Math.max(0, profile.hpCurrent - dmg);

    // Bled out from damage
    if (newHp <= 0) {
      await endExpedition(interaction.user.id, "die", session.id);

      const bleedLine = BLEED_LINES[Math.floor(Math.random() * BLEED_LINES.length)]!;
      const embed = new EmbedBuilder()
        .setColor(0x3a0a0a)
        .setTitle(`💀 ${interaction.user.username} — Bled Out`)
        .setDescription(
          `*${bleedLine}*\n\n` +
          `Took **${dmg} damage** — HP reached zero in the field.\n\n` +
          `**All equipped gear forfeit.**`
        )
        .setFooter({ text: "Ashenmoor · /hideout heal to recover" });

      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    await patchRpgProfile(interaction.user.id, { hpCurrent: newHp });

    // Gain loot
    const possibleLoot = session.location === "woods"
      ? ["oak_wood", "spruce_wood", "red_herb", "wolf_tooth", "thornvine", "crow_feather"]
      : ["stone", "copper_ore", "iron_ore", "ruby", "coal", "quartz"];

    const foundItem = possibleLoot[Math.floor(Math.random() * possibleLoot.length)]!;
    const qty = Math.floor(Math.random() * 3) + 1;
    session.loot[foundItem] = (session.loot[foundItem] ?? 0) + qty;
    session.eventsSurvived += 1;
    updateExpeditionSession(session);

    const locationLines = PUSH_EVENTS[session.location] ?? PUSH_EVENTS["woods"]!;
    const eventLine = locationLines[Math.floor(Math.random() * locationLines.length)]!;

    const hpBar = hpBarStr(newHp, 100);
    const nextDeathChance = Math.round((0.20 + session.eventsSurvived * 0.05) * 100);
    const lootSoFar = lootSummary(session.loot);

    const embed = new EmbedBuilder()
      .setColor(loc.color)
      .setTitle(`${loc.icon} ${loc.name} — Event ${session.eventsSurvived}`)
      .setDescription(
        `*${eventLine}*\n\n` +
        `**Took:** ${dmg} damage · **Found:** ${qty}× ${foundItem.replace(/_/g, " ")}\n` +
        `**HP** ${hpBar} ${newHp}/100\n\n` +
        `**Loot so far:**\n${lootSoFar}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Current death chance if you push: **${nextDeathChance}%***`
      )
      .setFooter({ text: `Expedition ${session.id} · ${session.eventsSurvived} events · Push or get out` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`expedition_push:${session.id}`)
        .setLabel(`Push Deeper (${nextDeathChance}% death)`)
        .setEmoji("☠️")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`expedition_extract:${session.id}`)
        .setLabel("Extract Now (Save Loot)")
        .setEmoji("🚪")
        .setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

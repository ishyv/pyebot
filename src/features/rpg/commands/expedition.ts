import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { startExpedition } from "@/features/rpg/expedition";
import { getRpgProfile } from "@/db/repositories/rpg";

const LOCATION_DATA: Record<string, {
  name: string;
  icon: string;
  color: number;
  entryLines: string[];
  lootPreview: string;
  deathNote: string;
}> = {
  woods: {
    name: "The Whispering Woods",
    icon: "🌲",
    color: 0x1e3a2f,
    entryLines: [
      "The gate warden doesn't wish you luck. He stopped doing that years ago.",
      "The tree line starts where the light stops. You step across.",
      "Something scrapes against bark in the canopy above. Could be wind. Could be teeth.",
      "The woods are named for what you hear at night. You haven't heard it yet.",
    ],
    lootPreview: "Oak Wood · Spruce Wood · Red Herb · Wolf Tooth",
    deathNote: "Death here erases what you built. All equipped gear is stripped from your corpse.",
  },
  mines: {
    name: "The Deep Mines",
    icon: "⛏️",
    color: 0x1a1a2e,
    entryLines: [
      "The shaft descends further than the map shows. It always does.",
      "The air here smells of ozone and old blood. You descend anyway.",
      "Your lantern casts a circle six feet wide. Anything beyond that is guessing.",
      "The foreman's last chalk mark on the wall is three years old. Nobody updated it.",
    ],
    lootPreview: "Iron Ore · Copper Ore · Stone · Ruby",
    deathNote: "If you die down here, your equipped gear stays in the dark. The Accord gets what's left.",
  },
};

export const data = new SlashCommandBuilder()
  .setName("expedition")
  .setDescription("Enter a high-stakes raid. Death means permanent loss of all equipped gear.")
  .addStringOption((opt) =>
    opt
      .setName("location")
      .setDescription("Where to venture")
      .setRequired(true)
      .addChoices(
        { name: "🌲 The Whispering Woods", value: "woods" },
        { name: "⛏️ The Deep Mines", value: "mines" },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const locationId = interaction.options.getString("location", true);
  const loc = LOCATION_DATA[locationId] ?? LOCATION_DATA["woods"]!;

  // Check current HP before entering
  const profileRes = await getRpgProfile(interaction.user.id);
  const profile = profileRes.isOk() ? profileRes.unwrap() : null;
  const currentHp = profile?.hpCurrent ?? 100;
  const hpBar = hpBarStr(currentHp, 100);

  const result = await startExpedition(interaction.user.id, locationId);

  if (result.isErr()) {
    const code = result.error.code;
    let title = "Cannot Enter";
    let desc = result.error.message;

    if (code === "IN_RAID") {
      title = `${loc.icon} Already in the Field`;
      desc = "You have an active expedition. Finish that one before starting another.\n\nIf you're stuck, the last push/extract message should still be available.";
    } else if (code === "DEAD") {
      title = `${loc.icon} You Are Dead`;
      desc = "Dead men don't raid. Visit the Hideout and pay the Therapist.\n\n`/hideout heal`";
    } else if (code === "NO_PROFILE") {
      title = "No Profile Found";
      desc = "You haven't started your RPG journey. Use `/rpg-profile` to begin.";
    }

    const embed = new EmbedBuilder()
      .setColor(0x3a1a1a)
      .setTitle(title)
      .setDescription(desc)
      .setFooter({ text: `Ashenmoor · Expeditions` });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const { session } = result.unwrap();
  const entryLine = loc.entryLines[Math.floor(Math.random() * loc.entryLines.length)]!;

  const embed = new EmbedBuilder()
    .setColor(loc.color)
    .setTitle(`${loc.icon} Entering: ${loc.name}`)
    .setDescription(
      `*${entryLine}*\n\n` +
      `**Your HP:** ${hpBar} ${currentHp}/100\n` +
      `**Possible Loot:** ${loc.lootPreview}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*${loc.deathNote}*`
    )
    .setFooter({ text: `Expedition ${session.id} · 0 events survived` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`expedition_push:${session.id}`)
      .setLabel("Push Deeper")
      .setEmoji("☠️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`expedition_extract:${session.id}`)
      .setLabel("Extract Now (Empty-Handed)")
      .setEmoji("🚪")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

function hpBarStr(current: number, max: number, length = 8): string {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const color = current > 60 ? "🟩" : current > 25 ? "🟨" : "🟥";
  return `${color} \`${bar}\``;
}

import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ensureRpgProfile, getRpgProfile } from "@/db/repositories/rpg";
import type { RpgProfileData } from "@/db/schemas/rpg-profile";
import { progressBar, coins } from "@/utils/fmt";
import { getUser } from "@/db/repositories/users";

export const data = new SlashCommandBuilder()
  .setName("rpg-profile")
  .setDescription("View your Ashenmoor dossier.")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const isSelf = target.id === interaction.user.id;

  if (isSelf) {
    const result = await ensureRpgProfile(target.id);

    if (result.isErr()) {
      await interaction.editReply({ content: `Error: ${result.error.message}` });
      return;
    }

    const profile = result.unwrap();

    // New profile with no profession → show onboarding
    if (!profile.starterKitType) {
      const embed = new EmbedBuilder()
        .setColor(0x1a1a2e)
        .setTitle("⚔️ Welcome to Ashenmoor")
        .setDescription(
          "*The gate warden looks you over. New face. He stamps a fresh ledger sheet.*\n\n" +
          "**Choose your path.** This determines your starting tools, your gathering access, and the first chapter of what you owe the world.\n\n" +
          "*You cannot change this later.*"
        )
        .addFields(
          {
            name: "⛏️ Miner",
            value: "Descend into the Deep Mines. Extract iron, copper, stone, and the occasional ruby. The work is dark, cold, and consistent — until it isn't.",
            inline: true,
          },
          {
            name: "🪓 Lumber",
            value: "Work the edges of the Whispering Woods. Oak, spruce, rare ironwood. The trees are aware of you. This is not a metaphor.",
            inline: true,
          },
        )
        .setFooter({ text: "Ashenmoor · Choose wisely — paths don't reset" });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("rpg:onboard:miner")
          .setLabel("⛏️ Miner Path")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("rpg:onboard:lumber")
          .setLabel("🪓 Lumber Path")
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // Load balance for display
    const userRes = await getUser(target.id);
    const balance = userRes.isOk() ? ((userRes.unwrap()?.currency?.coins ?? 0) as number) : 0;
    
    await interaction.editReply({ embeds: [buildProfileEmbed(target.username, profile, balance)] });
  } else {
    const result = await getRpgProfile(target.id);

    if (result.isErr()) {
      await interaction.editReply({ content: `Error: ${result.error.message}` });
      return;
    }

    const profile = result.unwrap();

    if (!profile) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x2a2a2a)
          .setTitle("No Record Found")
          .setDescription(`**${target.username}** has no dossier in the Ashenmoor ledger.\n\nThey haven't started their journey — or they never made it back.`)
          .setFooter({ text: "Ashenmoor · Registry" })]
      });
      return;
    }

    await interaction.editReply({ embeds: [buildProfileEmbed(target.username, profile, null)] });
  }
}

function hpBarStr(current: number, max: number, length = 10): string {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  const color = current > 60 ? "🟩" : current > 25 ? "🟨" : "🟥";
  return `${color} \`${"█".repeat(filled)}${"░".repeat(empty)}\` ${current}/${max}`;
}

function buildProfileEmbed(username: string, profile: RpgProfileData, balance: number | null): EmbedBuilder {
  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : 0;

  const pathLabel =
    profile.starterKitType === "miner"
      ? "⛏️ Miner"
      : profile.starterKitType === "lumber"
        ? "🪓 Lumber"
        : "—";

  const status = profile.isFighting
    ? "⚔️ In Combat"
    : profile.activeExpeditionId
    ? "🌲 On Expedition"
    : "🟢 Available";

  const color = profile.isFighting ? 0x8b0000 : profile.hpCurrent <= 0 ? 0x2a2a2a : 0x1a2a1a;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 ${username} — Ashenmoor Dossier`)
    .setDescription(
      profile.hpCurrent <= 0
        ? "*This drifter is currently dead. They need healing before they can act.*"
        : `*${pathLabel} · ${status}*`
    )
    .addFields(
      {
        name: "Vitals",
        value:
          `**HP** ${hpBarStr(profile.hpCurrent, 100)}\n` +
          (balance !== null ? `**Balance** ${coins(balance)}` : ""),
        inline: false,
      },
      {
        name: "Combat Record",
        value: `${profile.wins}W / ${profile.losses}L — **${winRate}% win rate**`,
        inline: true,
      },
      {
        name: "Stash",
        value: `${profile.stashSize ?? 20} slots max`,
        inline: true,
      },
    );

  // Equipment
  const equippedEntries = Object.entries(profile.loadout).filter(([, v]) => v !== null);
  if (equippedEntries.length > 0) {
    const equipLines = equippedEntries.map(([slot, item]) => {
      if (item && typeof item === "object" && "durability" in item) {
        const bar = progressBar(item.durability, 100, 6);
        return `\`${slot.padEnd(7)}\` ${item.itemId.replace(/_/g, " ")} ${bar}`;
      }
      return `\`${slot.padEnd(7)}\` ${typeof item === "string" ? item : "equipped"}`;
    });
    embed.addFields({ name: "Equipped", value: equipLines.join("\n") });
  } else {
    embed.addFields({ name: "Equipped", value: "*Nothing equipped. Vulnerable.*" });
  }

  embed.setFooter({ text: "Ashenmoor · Dossier · /hideout status for economy details" });

  return embed;
}

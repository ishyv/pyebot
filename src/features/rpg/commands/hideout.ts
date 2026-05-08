import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getRpgProfile, patchRpgProfile } from "@/db/repositories/rpg";
import { getUser, updateUserPaths } from "@/db/repositories/users";
import { coins } from "@/utils/fmt";

const HEAL_COST_PER_HP = 5;

const HEAL_QUOTES = [
  "The Therapist works quickly and without sympathy. Needle, thread, salve. The bill arrives before the bleeding stops.",
  "You pay. The Therapist patches you. No words are exchanged. This is what healthcare looks like here.",
  "The clinic smells of raw essence and copper-tipped antiseptic. You leave with less coin and more HP.",
];

const STASH_QUOTES = [
  "The clerk stamps your new allocation. More space. More to lose.",
  "Additional stash space approved. The Accord adds a notation to your file. They always do.",
  "Larger holding approved. The guards who protect it are no more attentive than before.",
];

export const data = new SlashCommandBuilder()
  .setName("hideout")
  .setDescription("Your Hideout: heal, upgrade your stash, and check your standing.")
  .addSubcommand((sub) =>
    sub
      .setName("heal")
      .setDescription("Pay the Therapist to restore HP. Costs 5 coins per HP.")
      .addIntegerOption((opt) =>
        opt
          .setName("amount")
          .setDescription("Amount of HP to heal (leave blank to heal as much as you can afford)")
          .setRequired(false)
          .setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("stash_upgrade")
      .setDescription("Expand your maximum stash capacity. Costs scale exponentially.")
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("View your current HP, stash capacity, and upgrade costs.")
  );

const STASH_TIERS: Array<{ max: number; cost: number; nextMax: number }> = [
  { max: 20,  cost: 5_000,   nextMax: 50  },
  { max: 50,  cost: 25_000,  nextMax: 100 },
  { max: 100, cost: 100_000, nextMax: 200 },
];

function getUpgradeCost(currentMax: number): { cost: number; nextMax: number } | null {
  const tier = STASH_TIERS.find(t => t.max === currentMax) 
    ?? STASH_TIERS.find(t => currentMax < t.nextMax);
  return tier ? { cost: tier.cost, nextMax: tier.nextMax } : null;
}

function hpBarStr(current: number, max: number, length = 10): string {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}


export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  const profileRes = await getRpgProfile(userId);
  if (profileRes.isErr() || !profileRes.unwrap()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x3a1a1a)
        .setTitle("No Profile Found")
        .setDescription("You haven't started your RPG journey. Use `/rpg-profile` to begin.")
        .setFooter({ text: "Ashenmoor · Hideout" })]
    });
    return;
  }
  const profile = profileRes.unwrap()!;

  const userRes = await getUser(userId);
  if (userRes.isErr() || !userRes.unwrap()) {
    await interaction.editReply({ content: "User data not found." });
    return;
  }
  const user = userRes.unwrap()!;
  const balance = (user.currency?.coins ?? 0) as number;
  const stashSize = profile.stashSize ?? 20;
  const upgrade = getUpgradeCost(stashSize);

  // ── STATUS ─────────────────────────────────────────────────────────────
  if (sub === "status") {
    const hpBar = hpBarStr(profile.hpCurrent, 100);
    const healable = Math.min(100 - profile.hpCurrent, Math.floor(balance / HEAL_COST_PER_HP));
    const healCost = healable * HEAL_COST_PER_HP;

    const embed = new EmbedBuilder()
      .setColor(0x1a2a1a)
      .setTitle("🏚️ Hideout Status")
      .setDescription(
        `**HP** \`${hpBar}\` ${profile.hpCurrent}/100\n` +
        `**Balance** ${coins(balance)}\n\n` +
        `Healing ${healable} HP would cost **${coins(healCost)}**.\n` +
        (profile.hpCurrent >= 100
          ? "*You are at full health.*"
          : balance < HEAL_COST_PER_HP
          ? "*You cannot afford any healing.*"
          : "")
      )
      .addFields(
        {
          name: "📦 Stash",
          value: upgrade
            ? `Current max: **${stashSize}** slots\nUpgrade to **${upgrade.nextMax}** costs **${coins(upgrade.cost)}**`
            : `**${stashSize}** slots — *fully upgraded*`,
          inline: false,
        }
      )
      .setFooter({ text: "Ashenmoor · Hideout — /hideout heal · /hideout stash_upgrade" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── HEAL ───────────────────────────────────────────────────────────────
  if (sub === "heal") {
    if (profile.hpCurrent >= 100) {
      const embed = new EmbedBuilder()
        .setColor(0x1a3a1a)
        .setTitle("🏥 Therapist")
        .setDescription("*The Therapist looks you over and shakes their head.*\n\nYou are at full health. There is nothing to bill you for.")
        .setFooter({ text: "Ashenmoor · Hideout" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let toHeal = interaction.options.getInteger("amount") ?? (100 - profile.hpCurrent);
    const maxAffordable = Math.floor(balance / HEAL_COST_PER_HP);

    if (maxAffordable <= 0) {
      const embed = new EmbedBuilder()
        .setColor(0x3a1a1a)
        .setTitle("🏥 Insufficient Funds")
        .setDescription(
          `*The Therapist doesn't look up from their ledger.*\n\n` +
          `Healing costs **${coins(HEAL_COST_PER_HP)} per HP**. ` +
          `You have **${coins(balance)}**. Come back with coin.`
        )
        .setFooter({ text: "Ashenmoor · Hideout" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Clamp to what they can afford and what's needed
    toHeal = Math.min(toHeal, maxAffordable, 100 - profile.hpCurrent);
    const totalCost = toHeal * HEAL_COST_PER_HP;
    const newHp = profile.hpCurrent + toHeal;

    await patchRpgProfile(userId, { hpCurrent: newHp });
    await updateUserPaths(userId, { "currency.coins": balance - totalCost });

    const hpBar = hpBarStr(newHp, 100);
    const quote = HEAL_QUOTES[Math.floor(Math.random() * HEAL_QUOTES.length)]!;

    const embed = new EmbedBuilder()
      .setColor(0x1a3a1a)
      .setTitle("🏥 Therapist")
      .setDescription(
        `*${quote}*\n\n` +
        `Healed **+${toHeal} HP** for **${coins(totalCost)}**.\n\n` +
        `**HP** \`${hpBar}\` ${newHp}/100\n` +
        `**Remaining Balance** ${coins(balance - totalCost)}`
      )
      .setFooter({ text: `Ashenmoor · Hideout · ${HEAL_COST_PER_HP} coins/HP` });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── STASH UPGRADE ──────────────────────────────────────────────────────
  if (sub === "stash_upgrade") {
    if (!upgrade) {
      const embed = new EmbedBuilder()
        .setColor(0x2a2a3a)
        .setTitle("📦 Stash — Fully Upgraded")
        .setDescription(`Your stash holds **${stashSize} slots**. There are no further expansions available.\n\n*The clerk's ledger has no line for this.*`)
        .setFooter({ text: "Ashenmoor · Hideout" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (balance < upgrade.cost) {
      const embed = new EmbedBuilder()
        .setColor(0x3a1a1a)
        .setTitle("📦 Insufficient Funds")
        .setDescription(
          `Expanding from **${stashSize}** to **${upgrade.nextMax}** slots costs **${coins(upgrade.cost)}**.\n\n` +
          `You have **${coins(balance)}**. You are short by **${coins(upgrade.cost - balance)}**.\n\n` +
          `*The clerk doesn't blink. Coin or go home.*`
        )
        .setFooter({ text: "Ashenmoor · Hideout" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await patchRpgProfile(userId, { stashSize: upgrade.nextMax });
    await updateUserPaths(userId, { "currency.coins": balance - upgrade.cost });

    const quote = STASH_QUOTES[Math.floor(Math.random() * STASH_QUOTES.length)]!;

    const embed = new EmbedBuilder()
      .setColor(0xc89b3c)
      .setTitle("📦 Stash Expanded")
      .setDescription(
        `*${quote}*\n\n` +
        `Paid **${coins(upgrade.cost)}** to expand stash capacity.\n\n` +
        `**New Capacity:** ${upgrade.nextMax} slots\n` +
        `**Remaining Balance:** ${coins(balance - upgrade.cost)}`
      )
      .setFooter({ text: "Ashenmoor · Hideout" });

    await interaction.editReply({ embeds: [embed] });
  }
}

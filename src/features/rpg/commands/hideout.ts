import type { ChatInputCommandInteraction } from "discord.js";
import { adjustBalance, getBalance } from "@/features/economy/mutations";
import { getRpgProfile, patchRpgProfile } from "@/features/rpg/profile";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
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

const data = command("hideout")
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
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("stash_upgrade")
      .setDescription("Expand your maximum stash capacity. Costs scale exponentially."),
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("View your current HP, stash capacity, and upgrade costs."),
  )
  .addSubcommand((sub) =>
    sub
      .setName("help")
      .setDescription("Learn how healing, stash upgrades, and expeditions fit together."),
  );

const STASH_TIERS: Array<{ max: number; cost: number; nextMax: number }> = [
  { max: 20, cost: 5_000, nextMax: 50 },
  { max: 50, cost: 25_000, nextMax: 100 },
  { max: 100, cost: 100_000, nextMax: 200 },
];

function getUpgradeCost(currentMax: number): { cost: number; nextMax: number } | null {
  const tier =
    STASH_TIERS.find((t) => t.max === currentMax) ??
    STASH_TIERS.find((t) => currentMax < t.nextMax);
  return tier ? { cost: tier.cost, nextMax: tier.nextMax } : null;
}

function hpBarStr(current: number, max: number, length = 10): string {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer();

  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (sub === "help") {
    await ctx.respond.send(hideoutHelpV2());
    return;
  }

  const profile = await getRpgProfile(ctx, userId).catch(() => null);
  if (!profile) {
    await ctx.respond.send(
      v2Message(
        container(
          "mute",
          text(
            "## No Profile Found\nYou haven't started your RPG journey. Use `/rpg-profile` to begin.\n-# Ashenmoor · Hideout",
          ),
        ),
      ),
    );
    return;
  }

  const balance = await getBalance(ctx, userId, "coins");
  const stashSize = profile.stashSize ?? 20;
  const upgrade = getUpgradeCost(stashSize);

  // ── STATUS ─────────────────────────────────────────────────────────────
  if (sub === "status") {
    const hpBar = hpBarStr(profile.hpCurrent, 100);
    const healable = Math.min(100 - profile.hpCurrent, Math.floor(balance / HEAL_COST_PER_HP));
    const healCost = healable * HEAL_COST_PER_HP;

    const stashText = upgrade
      ? `Current max: **${stashSize}** slots\nUpgrade to **${upgrade.nextMax}** costs **${coins(upgrade.cost)}**`
      : `**${stashSize}** slots — *fully upgraded*`;

    const healNote =
      profile.hpCurrent >= 100
        ? "*You are at full health.*"
        : balance < HEAL_COST_PER_HP
          ? "*You cannot afford any healing.*"
          : `Healing ${healable} HP would cost **${coins(healCost)}**.`;

    await ctx.respond.send(
      v2Message(
        container(
          "ok",
          text(
            `## 🏚️ Hideout Status\n**HP** \`${hpBar}\` ${profile.hpCurrent}/100\n**Balance** ${coins(balance)}\n\n${healNote}`,
          ),
          separator("lg"),
          text(
            `**📦 Stash**\n${stashText}\n\n-# Ashenmoor · Hideout — /hideout heal · /hideout stash_upgrade`,
          ),
        ),
      ),
    );
    return;
  }

  // ── HEAL ───────────────────────────────────────────────────────────────
  if (sub === "heal") {
    if (profile.hpCurrent >= 100) {
      await ctx.respond.send(
        v2Message(
          container(
            "ok",
            text(
              "## 🏥 Therapist\n*The Therapist looks you over and shakes their head.*\n\nYou are at full health. There is nothing to bill you for.\n\n-# Ashenmoor · Hideout",
            ),
          ),
        ),
      );
      return;
    }

    let toHeal = interaction.options.getInteger("amount") ?? 100 - profile.hpCurrent;
    const maxAffordable = Math.floor(balance / HEAL_COST_PER_HP);

    if (maxAffordable <= 0) {
      await ctx.respond.send(
        v2Message(
          container(
            "danger",
            text(
              `## 🏥 Insufficient Funds\n*The Therapist doesn't look up from their ledger.*\n\nHealing costs **${coins(HEAL_COST_PER_HP)} per HP**. You have **${coins(balance)}**. Come back with coin.\n\n-# Ashenmoor · Hideout`,
            ),
          ),
        ),
      );
      return;
    }

    // Clamp to what they can afford and what's needed
    toHeal = Math.min(toHeal, maxAffordable, 100 - profile.hpCurrent);
    const totalCost = toHeal * HEAL_COST_PER_HP;
    const newHp = profile.hpCurrent + toHeal;

    try {
      await patchRpgProfile(ctx, userId, { hpCurrent: newHp });
      await adjustBalance(ctx, userId, "coins", -totalCost);
    } catch {
      await ctx.respond.send({ content: "Failed to save healing. Please try again." });
      return;
    }

    const hpBar = hpBarStr(newHp, 100);
    const quote =
      HEAL_QUOTES[Math.floor(Math.random() * HEAL_QUOTES.length)] ?? HEAL_QUOTES[0] ?? "";

    await ctx.respond.send(
      v2Message(
        container(
          "ok",
          text(
            `## 🏥 Therapist\n*${quote}*\n\nHealed **+${toHeal} HP** for **${coins(totalCost)}**.\n\n**HP** \`${hpBar}\` ${newHp}/100\n**Remaining Balance** ${coins(balance - totalCost)}\n\n-# Ashenmoor · Hideout · ${HEAL_COST_PER_HP} coins/HP`,
          ),
        ),
      ),
    );
    return;
  }

  // ── STASH UPGRADE ──────────────────────────────────────────────────────
  if (sub === "stash_upgrade") {
    if (!upgrade) {
      await ctx.respond.send(
        v2Message(
          container(
            "mute",
            text(
              `## 📦 Stash — Fully Upgraded\nYour stash holds **${stashSize} slots**. There are no further expansions available.\n\n*The clerk's ledger has no line for this.*\n\n-# Ashenmoor · Hideout`,
            ),
          ),
        ),
      );
      return;
    }

    if (balance < upgrade.cost) {
      await ctx.respond.send(
        v2Message(
          container(
            "danger",
            text(
              `## 📦 Insufficient Funds\nExpanding from **${stashSize}** to **${upgrade.nextMax}** slots costs **${coins(upgrade.cost)}**.\n\nYou have **${coins(balance)}**. You are short by **${coins(upgrade.cost - balance)}**.\n\n*The clerk doesn't blink. Coin or go home.*\n\n-# Ashenmoor · Hideout`,
            ),
          ),
        ),
      );
      return;
    }

    try {
      await patchRpgProfile(ctx, userId, { stashSize: upgrade.nextMax });
      await adjustBalance(ctx, userId, "coins", -upgrade.cost);
    } catch {
      await ctx.respond.send({ content: "Failed to save stash upgrade. Please try again." });
      return;
    }

    const quote =
      STASH_QUOTES[Math.floor(Math.random() * STASH_QUOTES.length)] ?? STASH_QUOTES[0] ?? "";

    await ctx.respond.send(
      v2Message(
        container(
          "ok",
          text(
            `## 📦 Stash Expanded\n*${quote}*\n\nPaid **${coins(upgrade.cost)}** to expand stash capacity.\n\n**New Capacity:** ${upgrade.nextMax} slots\n**Remaining Balance:** ${coins(balance - upgrade.cost)}\n\n-# Ashenmoor · Hideout`,
          ),
        ),
      ),
    );
  }
}

function hideoutHelpV2() {
  return v2Message(
    container(
      "info",
      text(
        "## Hideout Guide\nThe hideout is your RPG recovery screen. Check health, pay for healing, and expand stash space before taking bigger risks.",
      ),
      separator("lg"),
      text(
        "**Status**\n`/hideout status` shows HP, coins, stash size, and the next upgrade cost.\n\n" +
          "**Healing**\n`/hideout heal` restores as much HP as you can afford. Use `amount` to heal a specific number.\n\n" +
          "**Stash**\n`/hideout stash_upgrade` buys more item capacity when you have enough coins.\n\n" +
          "**Expeditions**\n`/expedition` explains raids. Heal before you enter; death strips equipped gear.\n\n" +
          `-# Ashenmoor · Hideout · Healing costs ${HEAL_COST_PER_HP} coins/HP`,
      ),
    ),
  );
}

export default data
  .help({ hints: ["/expedition", "/balance"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );

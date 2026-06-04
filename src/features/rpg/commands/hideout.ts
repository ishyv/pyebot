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

/** Fetch profile + wallet together. Returns null (with a ready response) when profile is missing. */
async function loadHideoutData(ctx: Ctx, userId: string) {
  const profile = await getRpgProfile(ctx, userId).catch(() => null);
  if (!profile) return null;
  const balance = await getBalance(ctx, userId, "coins");
  const stashSize = profile.stashSize ?? 20;
  return { profile, balance, stashSize, upgrade: getUpgradeCost(stashSize) };
}

const NO_PROFILE = v2Message(
  container(
    "mute",
    text(
      "## No Profile Found\nYou haven't started your RPG journey. Use `/rpg-profile` to begin.\n-# Ashenmoor · Hideout",
    ),
  ),
);

const data = command("hideout")
  .description("Your Hideout: heal, upgrade your stash, and check your standing.")
  .subcommand({
    name: "heal",
    description: "Pay the Therapist to restore HP. Costs 5 coins per HP.",
    options: (s) =>
      s.integer("amount", "Amount of HP to heal (leave blank to heal as much as you can afford)", {
        min: 1,
      }),
    run: async (c) => {
      const data = await loadHideoutData(c.ctx, c.userId);
      if (!data) return NO_PROFILE;
      const { profile, balance } = data;

      if (profile.hpCurrent >= 100) {
        return v2Message(
          container(
            "ok",
            text(
              "## 🏥 Therapist\n*The Therapist looks you over and shakes their head.*\n\nYou are at full health. There is nothing to bill you for.\n\n-# Ashenmoor · Hideout",
            ),
          ),
        );
      }

      let toHeal = c.options.amount ?? 100 - profile.hpCurrent;
      const maxAffordable = Math.floor(balance / HEAL_COST_PER_HP);

      if (maxAffordable <= 0) {
        return v2Message(
          container(
            "danger",
            text(
              `## 🏥 Insufficient Funds\n*The Therapist doesn't look up from their ledger.*\n\nHealing costs **${coins(HEAL_COST_PER_HP)} per HP**. You have **${coins(balance)}**. Come back with coin.\n\n-# Ashenmoor · Hideout`,
            ),
          ),
        );
      }

      toHeal = Math.min(toHeal, maxAffordable, 100 - profile.hpCurrent);
      const totalCost = toHeal * HEAL_COST_PER_HP;
      const newHp = profile.hpCurrent + toHeal;

      try {
        await patchRpgProfile(c.ctx, c.userId, { hpCurrent: newHp });
        await adjustBalance(c.ctx, c.userId, "coins", -totalCost);
      } catch {
        return { content: "Failed to save healing. Please try again." };
      }

      const hpBar = hpBarStr(newHp, 100);
      const quote =
        HEAL_QUOTES[Math.floor(Math.random() * HEAL_QUOTES.length)] ?? HEAL_QUOTES[0] ?? "";

      return v2Message(
        container(
          "ok",
          text(
            `## 🏥 Therapist\n*${quote}*\n\nHealed **+${toHeal} HP** for **${coins(totalCost)}**.\n\n**HP** \`${hpBar}\` ${newHp}/100\n**Remaining Balance** ${coins(balance - totalCost)}\n\n-# Ashenmoor · Hideout · ${HEAL_COST_PER_HP} coins/HP`,
          ),
        ),
      );
    },
  })
  .subcommand({
    name: "stash_upgrade",
    description: "Expand your maximum stash capacity. Costs scale exponentially.",
    run: async (c) => {
      const data = await loadHideoutData(c.ctx, c.userId);
      if (!data) return NO_PROFILE;
      const { balance, stashSize, upgrade } = data;

      if (!upgrade) {
        return v2Message(
          container(
            "mute",
            text(
              `## 📦 Stash — Fully Upgraded\nYour stash holds **${stashSize} slots**. There are no further expansions available.\n\n*The clerk's ledger has no line for this.*\n\n-# Ashenmoor · Hideout`,
            ),
          ),
        );
      }

      if (balance < upgrade.cost) {
        return v2Message(
          container(
            "danger",
            text(
              `## 📦 Insufficient Funds\nExpanding from **${stashSize}** to **${upgrade.nextMax}** slots costs **${coins(upgrade.cost)}**.\n\nYou have **${coins(balance)}**. You are short by **${coins(upgrade.cost - balance)}**.\n\n*The clerk doesn't blink. Coin or go home.*\n\n-# Ashenmoor · Hideout`,
            ),
          ),
        );
      }

      try {
        await patchRpgProfile(c.ctx, c.userId, { stashSize: upgrade.nextMax });
        await adjustBalance(c.ctx, c.userId, "coins", -upgrade.cost);
      } catch {
        return { content: "Failed to save stash upgrade. Please try again." };
      }

      const quote =
        STASH_QUOTES[Math.floor(Math.random() * STASH_QUOTES.length)] ?? STASH_QUOTES[0] ?? "";

      return v2Message(
        container(
          "ok",
          text(
            `## 📦 Stash Expanded\n*${quote}*\n\nPaid **${coins(upgrade.cost)}** to expand stash capacity.\n\n**New Capacity:** ${upgrade.nextMax} slots\n**Remaining Balance:** ${coins(balance - upgrade.cost)}\n\n-# Ashenmoor · Hideout`,
          ),
        ),
      );
    },
  })
  .subcommand({
    name: "status",
    description: "View your current HP, stash capacity, and upgrade costs.",
    run: async (c) => {
      const data = await loadHideoutData(c.ctx, c.userId);
      if (!data) return NO_PROFILE;
      const { profile, balance, stashSize, upgrade } = data;

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

      return v2Message(
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
      );
    },
  })
  .subcommand({
    name: "help",
    description: "Learn how healing, stash upgrades, and expeditions fit together.",
    run: () => hideoutHelpV2(),
  })
  .defer("public");

export default data.help({ hints: ["/expedition", "/balance"] });

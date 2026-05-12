/**
 * Equip select-menu handler.
 *
 * Custom ID: `equip:select`
 * Called when a user picks a tool from the dropdown shown by /equip.
 */

import { EmbedBuilder, Colors, type StringSelectMenuInteraction } from "discord.js";
import { getUser } from "@/db/repositories/users";
import { patchRpgProfile } from "@/db/repositories/rpg";
import { getHints } from "@/utils/command-registry";
import { TOOLS } from "@/features/rpg/content/tools";

export const EQUIP_CUSTOM_ID = "equip:select";

/** All item IDs that can be equipped into the weapon slot. */
export const EQUIPABLE_TOOLS: ReadonlySet<string> = new Set(Object.keys(TOOLS));

export function isEquipSelect(customId: string): boolean {
  return customId === EQUIP_CUSTOM_ID;
}

export async function handleEquipSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const itemId = interaction.values[0];
  if (!itemId) return;

  const userId = interaction.user.id;
  const footer = { text: getHints("equip") };

  // Validate tool is still in the allowed set (guard against stale menus)
  if (!EQUIPABLE_TOOLS.has(itemId)) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setDescription(`\`${itemId}\` is not a valid tool.`)
          .setFooter(footer),
      ],
    });
    return;
  }

  // Re-fetch user to confirm current inventory (guard against race conditions)
  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setDescription("Something went wrong fetching your profile. Please try again.")
          .setFooter(footer),
      ],
    });
    return;
  }

  const user = userRes.unwrap();
  const inventory = user?.inventory ?? {};
  const qty = (inventory[itemId] as number | undefined) ?? 0;

  if (qty < 1) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setDescription(`You no longer have \`${itemId}\` in your inventory.`)
          .setFooter(footer),
      ],
    });
    return;
  }

  // Build new loadout preserving all existing slots
  const currentLoadout = user?.rpgProfile?.loadout ?? {
    weapon: null,
    shield: null,
    helmet: null,
    chest: null,
    pants: null,
    boots: null,
    ring: null,
    necklace: null,
  };

  const startingDurability = TOOLS[itemId as keyof typeof TOOLS]?.startingDurability ?? 100;
  const patchRes = await patchRpgProfile(userId, {
    loadout: {
      ...currentLoadout,
      weapon: { instanceId: crypto.randomUUID(), itemId, durability: startingDurability },
    },
  });

  if (patchRes.isErr()) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setDescription("Something went wrong equipping your item. Please try again.")
          .setFooter(footer),
      ],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle("🗡️ Equipped!")
        .setDescription(`You equipped \`${itemId}\`.`)
        .setFooter(footer),
    ],
  });
}

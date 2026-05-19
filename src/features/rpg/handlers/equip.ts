/**
 * Equip select-menu handler.
 *
 * Custom ID: `equip:select`
 * Called when a user picks a tool from the dropdown shown by /equip.
 */

import type { StringSelectMenuInteraction } from "discord.js";
import type { RpgProfileValue } from "@/components/rpg-profile";
import { getUser } from "@/db/repositories/users";
import { TOOLS } from "@/features/rpg/content/tools";
import { ensureRpgProfile, patchRpgProfile } from "@/features/rpg/profile";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

export const EQUIP_CUSTOM_ID = "equip:select";

/** All item IDs that can be equipped into the weapon slot. */
export const EQUIPABLE_TOOLS: ReadonlySet<string> = new Set(Object.keys(TOOLS));

export function isEquipSelect(customId: string): boolean {
  return customId === EQUIP_CUSTOM_ID;
}

export async function handleEquipSelect(
  interaction: StringSelectMenuInteraction,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const itemId = interaction.values[0];
  if (!itemId) return;

  const userId = interaction.user.id;

  // Validate tool is still in the allowed set (guard against stale menus)
  if (!EQUIPABLE_TOOLS.has(itemId)) {
    await interaction.editReply(
      v2Message(
        container("danger", text(`\`${itemId}\` is not a valid tool.\n-# ${getHints("equip")}`)),
      ),
    );
    return;
  }

  // Re-fetch user to confirm current inventory (guard against race conditions)
  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    await interaction.editReply(
      v2Message(
        container(
          "danger",
          text(
            `Something went wrong fetching your profile. Please try again.\n-# ${getHints("equip")}`,
          ),
        ),
      ),
    );
    return;
  }

  const user = userRes.unwrap();
  const inventory = user?.inventory ?? {};
  const qty = (inventory[itemId] as number | undefined) ?? 0;

  if (qty < 1) {
    await interaction.editReply(
      v2Message(
        container(
          "danger",
          text(`You no longer have \`${itemId}\` in your inventory.\n-# ${getHints("equip")}`),
        ),
      ),
    );
    return;
  }

  // Build new loadout preserving all existing slots
  let profile: RpgProfileValue;
  try {
    profile = await ensureRpgProfile(ctx, userId);
  } catch {
    await interaction.editReply(
      v2Message(
        container(
          "danger",
          text(
            `Something went wrong fetching your RPG profile. Please try again.\n-# ${getHints("equip")}`,
          ),
        ),
      ),
    );
    return;
  }

  const startingDurability = TOOLS[itemId as keyof typeof TOOLS]?.startingDurability ?? 100;
  try {
    await patchRpgProfile(ctx, userId, {
      loadout: {
        ...profile.loadout,
        weapon: { instanceId: crypto.randomUUID(), itemId, durability: startingDurability },
      },
    });
  } catch {
    await interaction.editReply(
      v2Message(
        container(
          "danger",
          text(
            `Something went wrong equipping your item. Please try again.\n-# ${getHints("equip")}`,
          ),
        ),
      ),
    );
    return;
  }

  await interaction.editReply(
    v2Message(
      container("ok", text(`## 🗡️ Equipped!\nYou equipped \`${itemId}\`.\n-# ${getHints("equip")}`)),
    ),
  );
}

import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { EQUIPABLE_TOOLS } from "@/features/rpg/handlers/equip";
import { getStackQuantity } from "@/features/rpg/inventory";
import { getRpgProfile } from "@/features/rpg/profile";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

export default command("equip")
  .description("Equip a tool from your inventory")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/expedition", "/rpg-profile"] })
  .run(async ({ ctx, userId }) => {
    const availableTools: Array<{ itemId: string; qty: number }> = [];
    for (const itemId of EQUIPABLE_TOOLS) {
      const qty = await getStackQuantity(ctx, userId, itemId);
      if (qty >= 1) availableTools.push({ itemId, qty });
    }

    if (availableTools.length === 0) {
      return v2Message(
        container(
          "warn",
          text(
            `You don't have any tools in your inventory. Craft one with \`/craft\`.\n-# ${getHints("equip")}`,
          ),
        ),
      );
    }

    const profile = await getRpgProfile(ctx, userId).catch(() => null);
    const currentWeapon = profile?.loadout?.weapon;
    const currentItemId =
      currentWeapon && typeof currentWeapon === "object" && "itemId" in currentWeapon
        ? currentWeapon.itemId
        : typeof currentWeapon === "string"
          ? currentWeapon
          : null;

    const selectOptions = availableTools.map(({ itemId, qty }) => {
      const isEquipped = itemId === currentItemId;
      return new StringSelectMenuOptionBuilder()
        .setValue(itemId)
        .setLabel(itemId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
        .setDescription(
          isEquipped ? `×${qty} in inventory (currently equipped)` : `×${qty} in inventory`,
        )
        .setDefault(isEquipped);
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId("equip:select")
      .setPlaceholder("Choose a tool to equip…")
      .addOptions(selectOptions);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    const bodyText = currentItemId
      ? `## 🗡️ Equip a Tool\nCurrently equipped: \`${currentItemId}\`\n\nSelect a tool from the dropdown to equip it.\n-# ${getHints("equip")}`
      : `## 🗡️ Equip a Tool\nSelect a tool from the dropdown to equip it.\n-# ${getHints("equip")}`;

    return {
      ...v2Message(container("info", text(bodyText))),
      components: [selectRow],
    };
  });

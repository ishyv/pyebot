import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { getUser } from "@/db/repositories/users";
import { EQUIPABLE_TOOLS } from "@/features/rpg/handlers/equip";
import { getRpgProfile } from "@/features/rpg/profile";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = new SlashCommandBuilder()
  .setName("equip")
  .setDescription("Equip a tool from your inventory");

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.user.id;

  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    await interaction.editReply({ content: "Something went wrong. Please try again." });
    return;
  }

  const user = userRes.unwrap();
  if (!user) {
    await interaction.editReply({ content: "User profile not found. Please try again." });
    return;
  }

  const inventory = user.inventory ?? {};

  // Filter inventory to items that are valid tools and present with qty >= 1
  const availableTools = Object.entries(inventory)
    .filter(([itemId, qty]) => EQUIPABLE_TOOLS.has(itemId) && typeof qty === "number" && qty >= 1)
    .map(([itemId, qty]) => ({ itemId, qty: qty as number }));

  if (availableTools.length === 0) {
    await interaction.editReply(
      v2Message(
        container(
          "warn",
          text(
            `You don't have any tools in your inventory. Craft one with \`/craft\`.\n-# ${getHints("equip")}`,
          ),
        ),
      ),
    );
    return;
  }

  const profile = await getRpgProfile(ctx, userId).catch(() => null);
  const currentWeapon = profile?.loadout?.weapon;
  const currentItemId =
    currentWeapon && typeof currentWeapon === "object" && "itemId" in currentWeapon
      ? currentWeapon.itemId
      : typeof currentWeapon === "string"
        ? currentWeapon
        : null;

  const options = availableTools.map(({ itemId, qty }) => {
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
    .addOptions(options);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const bodyText = currentItemId
    ? `## 🗡️ Equip a Tool\nCurrently equipped: \`${currentItemId}\`\n\nSelect a tool from the dropdown to equip it.\n-# ${getHints("equip")}`
    : `## 🗡️ Equip a Tool\nSelect a tool from the dropdown to equip it.\n-# ${getHints("equip")}`;

  await interaction.editReply({
    ...v2Message(container("info", text(bodyText))),
    components: [selectRow],
  });
}

export default defineCommand({
  data,
  help: { hints: ["/expedition", "/rpg-profile"] },
  execute,
});

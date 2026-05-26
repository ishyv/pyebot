import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { RpgProfile } from "@/components/rpg-profile";
import { UserInventory } from "@/components/user-inventory";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, section, separator, text, thumb, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("View your item inventory")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const [inv, profile] = await Promise.all([
    ctx.get(target.id, UserInventory),
    ctx.get(target.id, RpgProfile),
  ]);

  const slots = inv?.slots ?? {};

  // Flatten slots to [itemId, quantity] pairs for display
  const items: [string, number][] = [];
  for (const [itemId, slot] of Object.entries(slots)) {
    const qty = "qty" in slot ? slot.qty : slot.instances.length;
    if (qty > 0) items.push([itemId, qty]);
  }

  if (items.length === 0) {
    await ctx.respond.send(
      v2Message(
        container(
          "mute",
          section(
            `## ${target.username}'s Inventory\nEmpty — start gathering with \`/gather-mine\` or \`/gather-cutdown\`.`,
            thumb(target.displayAvatarURL(), "avatar"),
          ),
        ),
      ),
    );
    return;
  }

  // Determine equipped weapon so we can mark it
  const weapon = profile?.loadout?.weapon;
  const equippedItemId =
    weapon && typeof weapon === "object" && "itemId" in weapon
      ? weapon.itemId
      : typeof weapon === "string"
        ? weapon
        : null;

  const RAW = [
    "stone",
    "copper_ore",
    "iron_ore",
    "silver_ore",
    "oak_wood",
    "spruce_wood",
    "palm_wood",
    "pine_wood",
  ];
  const PROCESSED = [
    "stone_block",
    "copper_ingot",
    "iron_ingot",
    "silver_ingot",
    "oak_plank",
    "spruce_plank",
    "palm_plank",
    "pine_plank",
  ];

  const raw: string[] = [];
  const processed: string[] = [];
  const tools: string[] = [];
  const other: string[] = [];

  for (const [itemId, qty] of items) {
    const label = itemId.replace(/_/g, " ");
    const equipped = itemId === equippedItemId ? " ⚔️" : "";
    const line = `\`${label}\` ×${qty}${equipped}`;

    if (RAW.includes(itemId)) raw.push(line);
    else if (PROCESSED.includes(itemId)) processed.push(line);
    else if (itemId.includes("pickaxe") || itemId.includes("axe")) tools.push(line);
    else other.push(line);
  }

  const sections: string[] = [];
  if (tools.length) sections.push(`**🔧 Tools**\n${tools.join("\n")}`);
  if (raw.length) sections.push(`**⛏️ Raw Materials**\n${raw.join("\n")}`);
  if (processed.length) sections.push(`**🔩 Processed**\n${processed.join("\n")}`);
  if (other.length) sections.push(`**📦 Other**\n${other.join("\n")}`);

  await ctx.respond.send(
    v2Message(
      container(
        "info",
        section(`## ${target.username}'s Inventory`, thumb(target.displayAvatarURL(), "avatar")),
        separator("sm"),
        text(sections.join("\n\n")),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/craft", "/process", "/market-list"] },
  execute,
});

# RPG Content Authoring

RPG content is defined in `src/content/packs/default.ts`. That file is the
canonical source for built-in items, deterministic crafting recipes, gathering
locations, and drop tables.

Do not add new RPG content by editing `src/features/rpg/**` internals. Those
feature files read from the content registry. A couple of old crafting files
still exist as compatibility shims, but they are not the authoring surface.

## Quick Start

Each content pack uses typed helpers from `src/content/authoring.ts`:

```ts
import { defineContentPack } from "@/content/authoring";

export const DEFAULT_CONTENT_PACK = defineContentPack({
  id: "ashenmoor_default",

  items: {
    iron_ore: {
      id: "iron_ore",
      name: "Iron Ore",
      category: "mineral",
      rarity: "uncommon",
      trait1: "Density",
      trait2: "Sharpness",
      sources: ["gather"],
      description: "Deep-vein iron with crystalline grain structure.",
    },
  },

  locations: {},
  dropTables: {},
  recipes: {},
});
```

The object key and nested `id` must match. If you write `iron_ore: { id:
"iron" }`, TypeScript rejects it. Bratty, yes. Useful, also yes.

## IDs

Content IDs must match:

```txt
^[a-z0-9_]+$
```

Use stable nouns like `iron_ore`, `oak_forest`, or `stone_to_sharp`. Do not use
spaces, hyphens, uppercase letters, or display names as IDs. Once an ID is in
player inventory or saved data, treat it as permanent.

## Items

Items require:

- `id`, `name`, `description`
- `category`: `mineral`, `timber`, `herb`, `animal`, `reagent`, `medical`,
  `component`, `tool`, `weapon`, `armor`, `artifact`, or `misc`
- `rarity`: `common`, `uncommon`, `rare`, or `legendary`
- `trait1` and `trait2`: `Density`, `Sharpness`, `Organic`, `Toxicity`,
  `Magic`, `Liquid`, or `None`
- `sources`: one or more of `gather`, `expedition`, `craft`, `drop`, `quest`,
  or `shop`

Tools can also define metadata:

```ts
rusted_pickaxe: {
  id: "rusted_pickaxe",
  name: "Rusted Pickaxe",
  category: "tool",
  rarity: "common",
  trait1: "Density",
  trait2: "None",
  sources: ["quest"],
  description: "A starter pickaxe with a tired iron head.",
  rpgSlot: "tool",
  tool: { toolKind: "pickaxe", tier: 1, maxDurability: 30 },
}
```

## Recipes

Deterministic crafting recipes are content recipes with `type: "crafting"` and
`craftingMethod`.

```ts
stone_to_sharp: {
  id: "stone_to_sharp",
  name: "Stone to Sharp Stone",
  description: "Knock a stone into a cutting edge.",
  type: "crafting",
  craftingMethod: "transform",
  itemInputs: [{ itemId: "stone", quantity: 1 }],
  itemOutputs: [{ itemId: "sharp_stone", quantity: 1 }],
  xpReward: 0,
  enabled: true,
}
```

Processing recipes use `type: "processing"` and are discovered by their first
input item. Only one processing recipe may use a given first input.

## Locations And Drop Tables

Gathering locations define where a player can mine or cut wood. Drop tables
define what can be gained there.

```ts
locations: {
  iron_mine: {
    id: "iron_mine",
    name: "Iron Mine",
    action: "mine",
    profession: "miner",
    requiredTier: 3,
    materials: ["iron_ore"],
    dropTableId: "iron_mine_drops",
  },
},

dropTables: {
  iron_mine_drops: {
    id: "iron_mine_drops",
    action: "mine",
    profession: "miner",
    tier: 3,
    locationId: "iron_mine",
    entries: [{ itemId: "iron_ore", chance: 1, weight: 1, minQty: 2, maxQty: 5 }],
  },
},
```

Drop table `chance` is `0` to `1`. `maxQty` must be greater than or equal to
`minQty`. If `locationId` or `profession` is omitted, the table is global for
that filter.

## What Gets Checked

TypeScript catches:

- item key/id mismatches
- recipe input/output IDs that are not in the same typed pack
- drop table item IDs and location IDs that are not in the same typed pack
- location material IDs that are not in the same typed pack

Runtime validation catches:

- invalid ID format
- missing required fields
- duplicate IDs
- bad enum values
- unknown references from JSON5 legacy packs
- bad quantity ranges
- duplicate processing recipe inputs
- location/drop-table action mismatches

Run this before starting the bot:

```bash
bun test src/content/content.test.ts
```

For a broader check:

```bash
bun run typecheck
```

## Legacy JSON5 Packs

The loader still supports JSON/JSON5 packs when `CONTENT_PACKS_DIR` is set.
Those packs must include:

- `rpg.materials.json5`
- `rpg.craftables.json5`
- `rpg.recipes.json5`
- `rpg.drop_tables.json5`
- `rpg.locations.json5`

That path is for compatibility. New built-in content should go in the typed
pack.

## Common Mistakes

- Adding an item to a recipe output but forgetting to define the item.
- Renaming an item ID after players already have it in inventory.
- Using display text as an ID, like `Iron Ore`.
- Setting `maxQty` lower than `minQty`.
- Adding a mining location with a forest drop table.
- Defining a tool without `tool.toolKind`, which makes gathering fall back to
  weak ID-name guessing.
- Editing `src/features/rpg/crafting/item-registry.ts`; that file is a shim.

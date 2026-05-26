# RPG Content Authoring

The extended RPG catalog is defined in `src/content/packs/default.ts`. That
file is seed/catalog data for authoring and validation, not the live dashboard
editing path.

The embedded dashboard edits the active RPG runtime snapshot through the bot
bridge and persists it to Mongo as `rpg_content.active`. Keep dashboard changes
on that live bridge path. Source-pack edits belong in normal TypeScript changes
against this file.

The active bot runtime does not load a content registry. Commands for
gathering, processing, crafting, tools, and expeditions read the small typed
maps in `src/features/rpg/content/**`. Keep gameplay changes there until the
catalog and runtime content are reconciled.

## Quick Start

The extended catalog uses typed helpers from `src/content/authoring.ts`:

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
- unknown references between typed content records
- bad quantity ranges
- duplicate processing recipe inputs
- location/drop-table action mismatches

Run this before editing catalog data:

```bash
bun run typecheck
```

For a broader check:

```bash
bun run typecheck
```

## Common Mistakes

- Adding an item to a recipe output but forgetting to define the item.
- Renaming an item ID after players already have it in inventory.
- Using display text as an ID, like `Iron Ore`.
- Setting `maxQty` lower than `minQty`.
- Adding a mining location with a forest drop table.
- Assuming `src/content/packs/default.ts` changes active RPG bot behavior by
  itself. Runtime gameplay reads `src/features/rpg/content/**` and may be
  replaced at boot by the Mongo-backed dashboard snapshot.
- Trying to load external JSON/JSON5 content packs. tx supports the current
  typed content pack only.

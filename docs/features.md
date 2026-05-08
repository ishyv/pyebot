# Features

Every feature is a self-contained directory under `src/features/`. The framework discovers them through `src/features/manifest.ts`. Look at `src/features/tickets/` for the simplest real example, or `src/features/economy/` for a complex one with bus events.

RPG items, recipes, locations, and drop tables are not feature code. Add them through the typed content pack documented in [RPG Content Authoring](./content-authoring.md). The old files under `src/features/rpg/crafting/` are compatibility shims, not the place to add new content.

## Adding a feature

You need three things: a command, a feature module, and a manifest entry.

### The command

```ts
// src/features/polls/commands/poll.ts
import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create a poll")
  .addStringOption((o) => o.setName("question").setDescription("Question").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction, ctx: CommandContext) {
  // ctx has guildId, userId, commandName, guildConfig (pre-fetched, don't call getGuild yourself)
  const question = interaction.options.getString("question", true);
  await interaction.reply(`Poll: ${question}`);
}
```

### The module

```ts
// src/features/polls/index.ts
import type { FeatureModule } from "@/core/feature";
import * as pollCmd from "./commands/poll";

const polls: FeatureModule = {
  id: "polls",
  featureGate: "polls",   // ties to guild.features.polls — omit to always be on
  commands: [
    { data: pollCmd.data, execute: pollCmd.execute },
  ],
};

export default polls;
```

### The manifest entry

One line in `src/features/manifest.ts`:

```ts
() => import("@/features/polls/index").then((m) => m.default),
```

Done. Commands get uploaded to Discord, interactions get routed, feature gates get enforced.

If you used `featureGate`, also add the key to the `Features` enum in `src/db/schemas/guild.ts` so it gets a default value.

---

## Buttons and components

Export a `matches` function and a handler. The framework routes by calling `matches(customId)` on each registered handler until one returns true.

```ts
// src/features/polls/handlers/vote.ts
import { MessageFlags, type ButtonInteraction } from "discord.js";

const PREFIX = "poll_vote:";

export function isPollVote(id: string) { return id.startsWith(PREFIX); }

export async function handlePollVote(interaction: ButtonInteraction) {
  const option = interaction.customId.slice(PREFIX.length);
  await interaction.reply({ content: `Voted: ${option}`, flags: MessageFlags.Ephemeral });
}
```

Wire it in the module. Because the framework's `ComponentInteraction` is a union (button | select | modal), you cast at the call site:

```ts
import type { ComponentInteraction } from "@/core/feature";
import type { ButtonInteraction } from "discord.js";

components: [
  {
    prefix: "poll_vote:",
    matches: isPollVote,
    handle: (i: ComponentInteraction) => handlePollVote(i as ButtonInteraction),
  },
],
```

---

## Middleware

Two things run before every command automatically: `guildOnly` (blocks DMs) and `featureGate` (blocks disabled features). You can add more per-command via `middleware: [...]`.

Built-in factories:

```ts
import { cooldownMiddleware } from "@/middleware/cooldown";
import { requirePermissions } from "@/middleware/permissions";
import { minutesToMs } from "@/utils/time";
import { PermissionFlagsBits } from "discord.js";

commands: [
  {
    data: pollCmd.data,
    execute: pollCmd.execute,
    middleware: [
      cooldownMiddleware(minutesToMs(5)),
      requirePermissions(PermissionFlagsBits.ManageGuild),
    ],
  },
],
```

Don't stack `cooldownMiddleware` on commands that already handle cooldowns in their service layer.

Custom middleware returns `OkResult(undefined)` to pass or `ErrResult({ content: "..." })` to block:

```ts
import { OkResult, ErrResult } from "@/core/result";
import type { MiddlewareFn } from "@/core/feature";

const premiumOnly: MiddlewareFn = async (_interaction, ctx) => {
  if (!ctx.guildConfig.premium) return ErrResult({ content: "Premium only." });
  return OkResult(undefined);
};
```

---

## Event bus

Features talk to each other through `src/core/bus.ts` instead of importing each other directly. Events are typed — you get autocomplete and compile-time checks.

Emit from your service:

```ts
import { bus } from "@/core/bus";
bus.emit({ type: "item:gathered", userId, itemId: "iron_ore", qty: 3 });
```

Listen in `onLoad`:

```ts
onLoad() {
  bus.on("item:gathered", async (e) => {
    await updateStats(e.userId, e.itemId, e.qty);
  });
},
```

Listener errors are logged, never thrown back to the emitter. To add a new event type, add a variant to `BusEvent` in `src/core/bus.ts`.

---

## Client events

For things like `guildMemberAdd` or `messageCreate`:

```ts
// src/features/welcome/handlers/join.ts
import type { Client } from "discord.js";

export function register(client: Client) {
  client.on("guildMemberAdd", async (member) => { /* ... */ });
}
```

```ts
// in your module
events: [
  { event: "guildMemberAdd", register: registerJoin },
],
```

---

## Lifecycle hooks

- `onLoad()` — runs after DB connect, before Discord login. Bus subscriptions, intervals.
- `onReady(client)` — runs after the client is ready. Anything needing the live client.
- `onShutdown()` — runs on SIGINT/SIGTERM. Cleanup.

---

## Guild config

`ctx.guildConfig` is the guild's MongoDB document, already fetched. Access it directly:

```ts
const reward = ctx.guildConfig.economy.daily.dailyReward;
```

Every field uses Zod `.catch()` defaults so missing values never crash. If your feature needs its own config, add a sub-object to `GuildSchema` in `src/db/schemas/guild.ts`.

### Dashboard-editable feature config

Features can also declare their own admin-panel editable config. This keeps the field metadata beside the feature that owns it, while still storing values in the guild document.

```ts
// src/features/counting/config.ts
import { ChannelType } from "discord.js";
import { channelConfigField, defineFeatureConfig } from "@/core/featureConfig";

export const countingFeatureConfig = defineFeatureConfig({
  fields: {
    channel: channelConfigField({
      key: "channel",
      label: "Counting channel",
      description: "Channel where the counting game runs.",
      path: "counting.channelId",
      required: true,
      channelTypes: [ChannelType.GuildText],
    }),
  },
});
```

Then expose it from the feature module:

```ts
const counting: FeatureModule = {
  id: "counting",
  featureGate: "counting",
  config: countingFeatureConfig,
  commands: [],
  events: [{ event: "messageCreate", register: registerMessageCreate }],
};
```

The admin dashboard's Feature Config panel renders these fields automatically and writes through `updateGuildPaths`. Runtime code should resolve Discord entities through `resolveConfiguredChannel(...)`; deleted channels, missing values, and wrong channel types return `null` instead of throwing.

Config is still not state. Store volatile game/session state in a repository or feature-owned collection, not in the guild document.

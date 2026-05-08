# Features

Every feature is a decorated class under `src/features/` and is listed from
`src/features/manifest.ts`. The manifest loads classes; it does not load plain
feature objects.

RPG items, recipes, locations, and drop tables are content, not feature code.
Add them through the typed content pack documented in
[RPG Content Authoring](./content-authoring.md).

## Adding A Feature

Create a command module when the logic is large, then expose it through a
decorated feature class:

```ts
// src/features/polls/index.ts
import type { ChatInputCommandInteraction } from "discord.js";
import { Feature, SlashCommand } from "@/framework";

@Feature({ id: "polls", gate: "polls", intents: ["Guilds"] })
export default class PollsFeature {
  @SlashCommand({ name: "poll", description: "Create a poll" })
  async poll(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString("question", true);
    await interaction.reply(`Poll: ${question}`);
  }
}
```

Add it to `src/features/manifest.ts`:

```ts
() => import("@/features/polls/index").then((m) => m.default),
```

If you used `gate`, add the key to the `Features` enum in
`src/db/schemas/guild.ts` so new guild documents get an explicit default.

## Components

Use typed component decorators. The prefix is both documentation and the
startup uniqueness key.

```ts
import type { ButtonInteraction } from "discord.js";
import { Button, Feature } from "@/framework";

@Feature({ id: "polls", gate: "polls", intents: ["Guilds"] })
export default class PollsFeature {
  @Button({
    prefix: "poll_vote:",
    parse: (customId) => ({ option: customId.slice("poll_vote:".length) }),
  })
  async vote(interaction: ButtonInteraction, parsed: { option: string }): Promise<void> {
    await interaction.reply(`Voted: ${parsed.option}`);
  }
}
```

Use `matches` only when a route needs more than `startsWith(prefix)`.

## Middleware

Two middleware layers run before every command automatically: `guildOnly` and
`featureGate`. Add feature-specific middleware through `@Use(...)` or command
decorator options.

```ts
import { PermissionFlagsBits } from "discord.js";
import { Feature, SlashCommand, Use } from "@/framework";
import { requirePermissions } from "@/middleware/permissions";

@Feature({ id: "polls", gate: "polls", intents: ["Guilds"] })
@Use(requirePermissions(PermissionFlagsBits.ManageGuild))
export default class PollsFeature {
  @SlashCommand({ name: "poll", description: "Create a poll" })
  async poll() {
    // ...
  }
}
```

## Events And Jobs

Use `@Event` for Discord client events and declare required intents on both the
event and the feature. Use `@Job` for intervals so the framework can clear them
during shutdown.

```ts
@Feature({ id: "counting", gate: "counting", intents: ["GuildMessages", "MessageContent"] })
export default class CountingFeature {
  @Event({ name: "messageCreate", intents: ["GuildMessages", "MessageContent"] })
  async onMessage(message: import("discord.js").Message): Promise<void> {
    // ...
  }

  @Job({ name: "sweep", everyMs: 60_000, runOnReady: true })
  async sweep(): Promise<void> {
    // ...
  }
}
```

## Guild Config

`ctx.guildConfig` is the guild document fetched by the dispatcher. Missing
latest-version fields receive explicit schema defaults for new documents, but
malformed old top-level slices are rejected.

Dashboard-editable feature config stays beside the feature that owns it:

```ts
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

Config is not state. Store volatile game/session state in a repository or a
feature-owned collection, not in the guild document.

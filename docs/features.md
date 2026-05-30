# Features

Every feature is a folder under `src/features/` with an `index.ts` that exports
a `defineFeature(...)` descriptor. The framework discovers feature folders by
filesystem scan, then loads `commands/*.ts` modules and an optional
`handlers.ts` class.

Active RPG bot behavior reads the typed runtime maps in
`src/features/rpg/content/**`. The larger typed content pack documented in
[RPG Content Authoring](./content-authoring.md) is seed/catalog authoring data;
the embedded dashboard edits the active Mongo-backed runtime snapshot.

## Adding A Feature

Create the feature descriptor first:

```ts
// src/features/polls/index.ts
import { defineFeature } from "@/framework";

export default defineFeature({
  id: "polls",
  name: "Polls",
  description: "Create and manage polls.",
  defaultEnabled: true,
});
```

The descriptor shape is exact: `id`, `name`, `description`, and optional
`defaultEnabled`. Commands, handlers, dashboard config, gates, and arbitrary
metadata do not belong in `defineFeature`.

Then add command modules under `commands/`, built with the `command(name)` DSL
(full reference in [Framework Authoring](./framework-authoring.md)):

```ts
// src/features/polls/commands/poll.ts
import { command } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";

export default command("poll")
  .description("Create a poll")
  .string("question", "What are we voting on?", { required: true })
  .guildOnly()
  .help({ hints: ["Add poll options after creating the prompt."] })
  .run(async ({ options }) =>
    v2Message(container("ok", section(`## ${options.question}`))),
  );
```

Feature toggles are keyed by the descriptor `id` and stored in the
`guild_features` component collection. Use `defaultEnabled: false` when new
guilds should opt in. Old embedded guild-document feature values are ignored.

## Components

Use `@Handle` in a feature `handlers.ts` class for component routes. The prefix
is both documentation and the startup uniqueness key.

```ts
import type { ButtonInteraction } from "discord.js";
import { Handle } from "@/framework";

export default class PollHandlers {
  @Handle("poll_vote:")
  async vote(interaction: ButtonInteraction): Promise<void> {
    const option = interaction.customId.slice("poll_vote:".length);
    await interaction.reply(`Voted: ${option}`);
  }
}
```

Matching is `customId.startsWith(prefix)`.

## Middleware

The framework checks `guild_features.overrides` before running feature-owned commands.
Command-specific middleware still exists for migrated commands that use the
legacy middleware context.

```ts
import { PermissionFlagsBits } from "discord.js";
import { requirePermissions } from "@/middleware/permissions";

export const pollMiddleware = [
  requirePermissions(PermissionFlagsBits.ManageGuild),
];
```

## Events And Jobs

Use `@On(EventClass)` for framework events or `@Listen("discordEvent")` for raw
Discord.js events in `handlers.ts`.

```ts
import { Listen } from "@/framework";

export default class CountingHandlers {
  @Listen("messageCreate")
  async onMessage(message: import("discord.js").Message): Promise<void> {
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

# Framework Authoring

New bot behavior is authored as feature folders under `src/features/<id>/`.
The active runtime scans those folders at startup and compiles one loaded
feature list for dispatch, command registration, component routing, and admin
feature summaries.

## Feature Descriptor

Every feature folder needs an `index.ts` default export:

```ts
import { defineFeature } from "@/framework";

export default defineFeature({
  id: "polls",
  name: "Polls",
  description: "Create and manage polls.",
  defaultEnabled: true,
});
```

The folder name and descriptor `id` must match. Feature toggles are keyed by
that `id`; there is no separate toggle key in the active runtime.
The only supported descriptor fields are `id`, `name`, `description`, and
optional `defaultEnabled`. Commands, handlers, config, gates, and arbitrary
metadata are rejected by TypeScript and belong in their own feature files.

## Commands

Command files live in `commands/*.ts` and default-export `defineCommand(...)`.
The loader rejects malformed command modules at boot instead of silently
skipping them.

```ts
import { SlashCommandBuilder } from "discord.js";
import { defineCommand } from "@/framework";

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll"),
  help: { hints: ["Use the generated buttons to vote."] },
  async execute(interaction, ctx) {
    ctx.logger.info("Creating poll");
    await interaction.reply("Poll created.");
  },
});
```

## Components

Component routes live in an optional `handlers.ts` class. Use `@Handle` with
the custom ID prefix the route owns.

```ts
import type { ButtonInteraction } from "discord.js";
import { Handle } from "@/framework";

export default class PollHandlers {
  @Handle("poll:")
  async handlePollButton(interaction: ButtonInteraction): Promise<void> {
    const actionId = interaction.customId.slice("poll:".length);
    await interaction.reply(`Handled ${actionId}.`);
  }
}
```

The router chooses the longest matching prefix, so specific prefixes can sit
beside broader ones.

## Events

Use `@On(EventClass)` for framework events and `@Listen("discordEvent")` for
raw Discord.js events that need direct client event access.

```ts
import { Listen } from "@/framework";

export default class CountingHandlers {
  @Listen("messageCreate")
  async onMessage(message: import("discord.js").Message): Promise<void> {
    // ...
  }
}
```

## Latest-Only Boundary

The active runtime is `bootstrapFramework(...)` plus folder discovery. Do not
reintroduce the deleted `RuntimeFeature` registry/dispatcher path or the older
`createBot` decorated-class API while refactoring.

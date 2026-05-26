# Framework Authoring

New bot behavior is authored as feature folders under `src/features/<id>/`.
The active runtime scans those folders at startup and compiles one loaded
feature list for dispatch, command registration, component routing, and admin
feature summaries.

The local CLI can scaffold the boring parts without becoming a second registry:

```bash
bun run tx -- new feature --id polls --name Polls --description "Create and manage polls."
bun run tx -- new command --feature polls --name poll --description "Create a poll"
bun run tx -- check authoring
```

Scaffolds refuse existing files by default. Add `--dry-run` to preview planned
writes. `tx check authoring` uses the same loader/catalog metadata as runtime
startup, but does not log into Discord or connect to Mongo.

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
    await ctx.respond.send({ content: "Poll created." });
  },
});
```

## Responding

Reply to commands through `ctx.respond`, not the raw `interaction` methods:

- `ctx.respond.defer({ visibility: "ephemeral" })` — acknowledge early for slow work
  (omit `visibility` for a public reply).
- `ctx.respond.send(payload)` — reply, edit the deferred reply, or follow up, chosen
  automatically from the interaction's current state.
- `ctx.respond.fail(payload)` — like `send` but forces the message ephemeral; use for errors.

`ctx.respond` tracks the deferred/replied lifecycle, returns a `Result` instead of throwing,
and pre-validates the payload (content length, embed/component limits, Components V2 ceiling).
Reach for the raw `interaction` API only when the responder can't express the intent —
e.g. a component handler editing its own message via `interaction.update()` /
`interaction.deferUpdate()`, or posting a *public* `interaction.followUp()` while keeping an
ephemeral deferred reply.

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

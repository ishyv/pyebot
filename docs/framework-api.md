# Framework API Reference

Short reference for feature authors. See
[Framework Authoring](./framework-authoring.md) for the longer guide and
[`src/features/example/`](../src/features/example/) for a runnable example.

## Imports

```ts
import { Handle, Listen, On, command, component, defineFeature } from "@/framework";
import type { Ctx } from "@/framework";
```

Dashboard config helpers:

```ts
import { booleanConfigField, channelConfigField, defineFeatureConfig } from "@/core/featureConfig";
```

## Feature Folders

| File | Purpose |
| --- | --- |
| `index.ts` | Required `defineFeature(...)` descriptor. |
| `commands/*.ts` | Optional slash commands. |
| `handlers.ts` | Optional component and event handlers. |
| `config.ts` | Optional dashboard config metadata. |

```ts
import { defineFeature } from "@/framework";

export default defineFeature({
  id: "polls",
  name: "Polls",
  description: "Create and manage polls.",
  defaultEnabled: true,
});
```

The descriptor supports `id`, `name`, `description`, and optional
`defaultEnabled`. The folder name and `id` must match.

## Commands

```ts
import { command } from "@/framework";

export default command("poll")
  .description("Create a poll")
  .string("question", "What are we voting on?", { required: true })
  .guildOnly()
  .defer("ephemeral")
  .run(async (c) => c.ok(`## ${c.options.question}`));
```

| Method | Purpose |
| --- | --- |
| `.description(text)` | Slash-command description. |
| `.help({ hints, requires })` | Help metadata. |
| `.hidden()` | Hide from generated help. |
| `.adminOnly()` | Require Manage Guild before execution. |
| `.guildOnly()` | Disable DMs and narrow guild fields in handlers. |
| `.defer("ephemeral" | "public")` | Acknowledge before handler work. |
| `.cooldown(duration, scope?)` | Add a cooldown. Scope: `user`, `guild`, `channel`, or `global`. |
| `.defaultMemberPermissions(bits)` | Set Discord default member permissions. |
| `.require(subcommand, bits)` | Add an extra permission gate to one top-level subcommand. |
| `.autocomplete(handler)` | Handle option autocomplete. |
| `.catch(ErrorClass, mapper)` | Map expected errors to responses. |
| `.build(factory)` | Reuse option groups in the builder chain. |

Option builders: `.string`, `.integer`, `.boolean`, `.user`, `.channel`,
`.role`, `.mentionable`, `.attachment`.

`{ required: true }` makes the value non-null in `c.options`.

## Subcommands

```ts
export default command("note")
  .description("Manage notes")
  .subcommand({
    name: "add",
    description: "Add a note",
    options: (s) =>
      s.user("user", "Who", { required: true }).string("text", "Note", { required: true }),
    run: async (c) => {
      const { user, text } = c.options;
      return c.ok(`Noted ${user.username}: ${text}`);
    },
  })
  .subcommand({
    name: "list",
    description: "List notes",
    options: (s) => s.user("user", "Who", { required: true }),
    run: async (c) => c.info(`Notes for ${c.options.user.username}`),
  });
```

Use `.handle(name, fn)` when the handler function is declared separately.

Groups:

```ts
export default command("modset")
  .description("Moderation settings")
  .group("raid", "Raid settings", (g) =>
    g.subcommand({
      name: "status",
      description: "Show raid settings",
      run: async (c) => c.info("Raid settings are available."),
    }),
  );
```

## Run Context

| Field/helper | Purpose |
| --- | --- |
| `c.interaction` | Raw Discord chat input interaction. |
| `c.ctx` | Framework `Ctx`. |
| `c.user`, `c.userId` | Calling user. |
| `c.guild`, `c.guildId`, `c.member` | Guild fields. |
| `c.options` | Typed command or subcommand options. |
| `c.subcommand`, `c.subcommandGroup` | Current route metadata. |
| `c.unwrap(result, mapErr)` | Return a mapped response for `Err`. |
| `c.unwrapOr(result, fallback)` | Use a fallback for `Err`. |
| `c.expect(result)` | Throw the error from `Err`. |
| `c.ok/info/warn/fail(markdown)` | Build themed Components V2 responses. |

Use `ctx.respond.defer`, `ctx.respond.send`, and `ctx.respond.fail` for
multi-step interaction responses.

## Handlers And Events

```ts
import type { ButtonInteraction } from "discord.js";
import { type Ctx, Handle, Listen } from "@/framework";

export default class PollHandlers {
  @Handle("poll:")
  async onPollButton(interaction: ButtonInteraction, ctx: Ctx): Promise<void> {
    await ctx.respond.send({ content: `Handled ${interaction.customId}.` });
  }

  @Listen("messageCreate")
  async onMessage(message: import("discord.js").Message): Promise<void> {
    if (message.author.bot || !message.guildId) return;
  }
}
```

| Decorator | Purpose |
| --- | --- |
| `@Handle("prefix:")` | Route component custom IDs by longest matching prefix. |
| `@On(EventClass)` | Listen to framework events emitted through `ctx.emit(...)`. |
| `@Listen("discordEvent")` | Listen to raw Discord.js client events. |

Raw Discord listeners should self-gate feature toggles when needed.

## Components And Ctx

```ts
import { z } from "zod";
import { component } from "@/framework";

export const PollState = component({
  collection: "poll_states",
  schema: z.object({
    question: z.string(),
    votes: z.record(z.string(), z.number()).default({}),
  }),
});
```

| Method/property | Purpose |
| --- | --- |
| `ctx.get(id, Component)` | Read a document or return `null`. |
| `ctx.ensure(id, Component)` | Read or create from schema defaults. |
| `ctx.set(id, Component, value)` | Replace a document. |
| `ctx.patch(id, Component, patch)` | Partially update a document. |
| `ctx.delete(id, Component)` | Delete a document. |
| `ctx.query(Component, options)` | Query across entities. |
| `ctx.emit(event)` | Emit a framework event. |
| `ctx.client` | Discord.js client. |
| `ctx.logger` | Feature-tagged logger. |
| `ctx.cooldowns`, `ctx.locks`, `ctx.sessions` | Shared runtime state helpers. |
| `ctx.respond` | Interaction response helper. |

## Dashboard Config

```ts
import { ChannelType } from "discord.js";
import { channelConfigField, defineFeatureConfig } from "@/core/featureConfig";

export const pollFeatureConfig = defineFeatureConfig({
  fields: {
    channel: channelConfigField({
      key: "channel",
      label: "Poll channel",
      description: "Channel where poll prompts are posted.",
      path: "polls.channelId",
      required: false,
      channelTypes: [ChannelType.GuildText],
    }),
  },
});
```

Field helpers: `channelConfigField`, `booleanConfigField`,
`numberConfigField`, `stringConfigField`, `selectConfigField`.

## Latest-Only Boundary

Active runtime path: feature folder discovery plus `bootstrapFramework(...)`.

Do not reintroduce old feature registries, `defineCommand`, raw feature-owned
`SlashCommandBuilder` authoring, old env aliases, or compatibility loaders.

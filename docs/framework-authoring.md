# Framework Authoring

New bot behavior is authored as feature folders under `src/features/<id>/`.
The active runtime scans those folders at startup and compiles one loaded
feature list for dispatch, command registration, component routing, and admin
feature summaries.

For a runnable, heavily-commented end-to-end reference, read
`src/features/example/` — a real feature (shipped disabled) that exercises the
descriptor, the `command()` DSL with options and subcommands, a Components-V2
reply with a button, a `@Handle` component route, and feature config.

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

Command files live in `commands/*.ts` and default-export a command built with the
fluent `command(name)` DSL from `@/framework`. There is no `defineCommand` and no raw
`SlashCommandBuilder`: options are declared on the builder, and the typed `.run()`
handler **returns** the response payload. The loader rejects malformed command modules
at boot instead of silently skipping them.

```ts
import { command } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";

export default command("poll")
  .description("Create a poll")
  .string("question", "What are we voting on?", { required: true })
  .guildOnly()
  .defer("ephemeral")            // or "public"; omit for an immediate reply
  .help({ hints: ["Use the generated buttons to vote."] })
  .run(async ({ ctx, user, options }) => {
    ctx.logger.info("Creating poll");
    return v2Message(container("ok", section(`## ${options.question}`)));
  });
```

Option builders: `.string/.integer/.boolean/.user/.channel/.role(name, description, settings?)`.
Pass `{ required: true }` to make a value non-optional in the typed `options` object.
`.guildOnly()` narrows `ctx.guild` to non-null inside `.run`.

### Subcommands

Declare subcommands with `.subcommand(name, description, build)` and handle each with
`.handle(name, ...)`, which gives `c.options` typed to that subcommand only. Group with
`.group(...)`. Route by name — never branch on `if (c.subcommand === "x")` (see AGENTS.md).

```ts
export default command("note")
  .description("Manage user notes")
  .subcommand("add", "Add a note", (s) =>
    s.user("user", "Who", { required: true }).string("text", "Note", { required: true }),
  )
  .handle("add", async (c) => {
    const { user, text } = c.options; // typed to the "add" subcommand
    return v2Message(container("ok", section(`Noted ${user.username}: ${text}`)));
  });
```

## Responding

Prefer **returning** a `v2Message(...)` payload from `.run()` / `.handle()` — the framework
turns the return value into the reply, choosing reply-vs-edit-deferred from interaction state,
and pre-validating the payload (content length, embed/component limits, Components V2 ceiling).

For multi-step flows, reach for `ctx.respond`:

- `ctx.respond.defer({ visibility: "ephemeral" })` — acknowledge early for slow work
  (or use the DSL sugar `.defer("ephemeral" | "public")`).
- `ctx.respond.send(payload)` — reply, edit the deferred reply, or follow up, chosen
  automatically from the interaction's current state. Returns a `Result` instead of throwing.
- `ctx.respond.fail(payload)` — like `send` but forces the message ephemeral; use for errors.
- `c.unwrap(result)` — unwrap a `Result` or short-circuit `.run()` with a mapped error message.

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

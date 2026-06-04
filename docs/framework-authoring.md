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

Declare subcommands with `.subcommand({ name, description, options, run })`.
The `run` callback gets `c.options` typed to that subcommand only. Group with
`.group(...)`. Route by declaration — never branch on `if (c.subcommand === "x")`
(see AGENTS.md). Use `.handle(name, fn)` only when the handler function is
declared separately.

```ts
export default command("note")
  .description("Manage user notes")
  .subcommand({
    name: "add",
    description: "Add a note",
    options: (s) =>
      s.user("user", "Who", { required: true }).string("text", "Note", { required: true }),
    run: async (c) => {
      const { user, text } = c.options; // typed to the "add" subcommand
      return v2Message(container("ok", section(`Noted ${user.username}: ${text}`)));
    },
  });
```

## Responding

Prefer **returning** a `v2Message(...)` payload from command/subcommand handlers — the framework
turns the return value into the reply, choosing reply-vs-edit-deferred from interaction state,
and pre-validating the payload (content length, embed/component limits, Components V2 ceiling).

For multi-step flows, reach for `ctx.respond`:

- `ctx.respond.defer({ visibility: "ephemeral" })` — acknowledge early for slow work
  (or use the DSL sugar `.defer("ephemeral" | "public")`).
- `ctx.respond.send(payload)` — reply, edit the deferred reply, or follow up, chosen
  automatically from the interaction's current state. Returns a `Result` instead of throwing.
- `ctx.respond.sendGroup(v2Group(...))` — send a logical Components V2 response as one or
  more linked messages when the V2 component/text budget requires it. The returned runtime
  handle supports `replace(nextGroup)` and `delete()`.
- `ctx.respond.fail(payload)` — like `send` but forces the message ephemeral; use for errors.
- `c.unwrap(result)` — unwrap a `Result` or short-circuit `.run()` with a mapped error message.

Reach for the raw `interaction` API only when the responder can't express the intent —
e.g. a component handler editing its own message via `interaction.update()` /
`interaction.deferUpdate()`, or posting a *public* `interaction.followUp()` while keeping an
ephemeral deferred reply.

## Handlers: routes and events

A feature's optional `handlers.ts` default-exports a flat list of registrations
built by free-scope helpers — no class, no decorators. The loader discovers the
list; bootstrap wires each entry. There are three kinds: component routes,
framework bus events, and raw Discord events.

### Typed component routes

Declare a feature's component routes once with `defineRoutes` (conventionally in
`routes.ts`). The same typed table drives BOTH encoding (building a button's
customId) and decoding (handing the handler already-parsed, typed args). This
replaces stringly-typed `customId`s and hand-written parsers.

```ts
// routes.ts
import { defineRoutes, snowflake } from "@/framework";

export const routes = defineRoutes("poll", {
  vote: { pollId: snowflake, choice: snowflake }, // → "poll:vote:<id>:<id>"
});
```

Encode at the call site, fully typed (a wrong arg name/type is a compile error):

```ts
// in a command/view
routes.vote.button({ pollId, choice }, { label: "Vote" }); // prefilled ButtonBuilder
routes.vote.id({ pollId, choice }); // the raw customId string, if you build the component yourself
```

Handle by route name; `args` is decoded and typed from the schema with no
annotations. A stale or malformed customId is skipped before the handler runs:

```ts
// handlers.ts
import { defineHandlers, routeHandlers } from "@/framework";
import { routes } from "./routes";

export default defineHandlers([
  ...routeHandlers(routes, {
    vote: async (interaction, args, ctx) => {
      // args: { pollId: string; choice: string }
    },
  }),
]);
```

Codec primitives: `str`, `int`, `snowflake`, `oneOf([...])` (a literal union),
and `rest` (a greedy trailing field that may contain colons — must be last).
Declare a component kind with `route(schema, "select" | "modal" | ...)` so the
handler's `interaction` narrows (e.g. to `StringSelectMenuInteraction`); a bare
schema defaults to `"button"`. The codec owns only the `customId` — a select's
`interaction.values` and a modal's `interaction.fields` are read directly.

### Events

Fold events into the same list. `on(EventClass, ...)` listens on the framework
bus (the class is both the key and the payload type); `listen("name", ...)`
listens to a raw Discord event (args typed from discord.js `ClientEvents`):

```ts
import { defineHandlers, listen, on } from "@/framework";
import { MemberJoined } from "@/events/member-joined";

export default defineHandlers([
  on(MemberJoined, async (event, ctx) => { /* event: MemberJoined */ }),
  listen("messageCreate", async (message, ctx) => { /* message: Message */ }),
]);
```

Raw `listen(...)` handlers bypass the feature toggle — self-gate them (see
`src/features/counting/handlers.ts`). `src/features/example/` is the runnable
reference adopter.

### Legacy decorator class (being migrated out)

The previous style — a `handlers.ts` class with `@Handle`/`@On`/`@Listen`
methods — still loads (the loader supports both) while features migrate to the
list above. Do not author new features with it.

## Latest-Only Boundary

The active runtime is `bootstrapFramework(...)` plus folder discovery. Do not
reintroduce the deleted `RuntimeFeature` registry/dispatcher path or the older
`createBot` decorated-class API while refactoring.

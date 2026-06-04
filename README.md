# tx-v2

tx-v2 is a Bun-first TypeScript framework and starter bot for Discord projects
that should feel like normal application code: feature folders, typed command
modules, explicit persistence, and a dashboard that reads the same metadata the
runtime uses.

| What you build | What tx gives you |
| --- | --- |
| Slash commands | Fluent `command(name)` DSL with typed options, subcommands, cooldowns, permissions, and deferred replies |
| Feature modules | Folder-based discovery under `src/features/<id>/` with one small descriptor |
| Components and events | Feature-owned handlers for Discord interactions, framework events, and raw Discord events |
| State | Mongo-backed `component(...)` models accessed through `Ctx` |
| Operations | Feature toggles, config metadata, doctor checks, and an embedded Svelte dashboard |

> [!TIP]
> New here? Read the Quick Start, skim the Framework API table, then open
> [`src/features/example/`](./src/features/example/). That example is the boring
> path on purpose.

## Quick Start

Requirements:

- Bun 1.1.0 or newer
- a Discord application and bot token
- MongoDB when running the bundled full bot feature set

Install dependencies and check the environment:

```bash
bun install
cp .env.example .env
bun run doctor
bun run dev
```

Edit `.env`:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_client_id
GUILD_ID=optional_dev_guild_id

# Optional for starter bots, required for the bundled full bot.
MONGO_URI=mongodb://localhost:27017
DB_NAME=txbot
```

Use `GUILD_ID` while developing slash commands so Discord updates them quickly.
Leave it empty for global command registration.

> [!NOTE]
> This repository currently targets Bun. Node support is not a promise until the
> Bun path is dull, reliable, and worth copying.

## First Feature

Create a feature folder with an `index.ts` descriptor.

```ts
// src/features/hello/index.ts
import { defineFeature } from "@/framework";

export default defineFeature({
  id: "hello",
  name: "Hello",
  description: "Small example command.",
  defaultEnabled: true,
});
```

`defineFeature` accepts only `id`, `name`, `description`, and optional
`defaultEnabled`. Commands, handlers, config, and gates live in separate files.

Add commands under `commands/*.ts`.

```ts
// src/features/hello/commands/hello.ts
import { command } from "@/framework";

export default command("hello")
  .description("Say hello")
  .string("message", "Greeting text", { required: true })
  .guildOnly()
  .defer("ephemeral")
  .cooldown("30s")
  .run(async (c) => c.ok(`Hello, ${c.user.username}. ${c.options.message}`));
```

References:

- [`docs/framework-api.md`](./docs/framework-api.md) - compact API reference
- [`docs/framework-authoring.md`](./docs/framework-authoring.md) - authoring guide
- [`src/features/example/`](./src/features/example/) - runnable reference feature

## Framework API

The common authoring surface fits on one screen:

| Need | Use |
| --- | --- |
| Feature descriptor | `defineFeature({ id, name, description, defaultEnabled })` |
| Slash command | `command("name").description("...").run(...)` |
| Typed options | `.string`, `.integer`, `.boolean`, `.user`, `.channel`, `.role`, `.mentionable`, `.attachment` |
| Subcommands | `.subcommand({ name, description, options, run })` |
| Subcommand groups | `.group("admin", "...", (g) => g.subcommand({ ... }))` |
| Guild-only commands | `.guildOnly()` |
| Early ACK | `.defer("ephemeral")` or `.defer("public")` |
| Cooldowns | `.cooldown("24h", "user")` |
| Permissions | `.defaultMemberPermissions(...)` and `.require("subcommand", permission)` |
| Component routes | `handlers.ts` with typed route handlers |
| Events | Framework bus events or raw Discord event listeners |
| Persistence | `component({ collection, schema })` plus `ctx.get/ensure/set/patch/delete/query` |
| Replies | return payloads, or use `ctx.respond` for multi-step flows |
| Dashboard config | `defineFeatureConfig(...)` from `@/core/featureConfig` |

Use object subcommands for inline handlers.

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
  });
```

Do not branch on `c.subcommand`. Use object `run` for inline behavior or
`.handle(name, fn)` for separated handler functions.

## Project Map

| Path | Purpose |
| --- | --- |
| `src/framework/**` | Loader, command DSL, component routing, event bus, `World`, and `Ctx` |
| `src/core/**` | DB, logging, response helpers, feature config metadata, result/state helpers, and legacy middleware context |
| `src/features/**` | Bundled moderation, economy, RPG, AI, tickets, offers, automod, autoroles, admin panels, and counting features |
| `src/features/example/**` | Annotated reference feature |
| `src/features/rpg/content/**` | Active RPG runtime content |
| `src/content/**` | Seed/catalog authoring helpers |
| `webapp/**` | Embedded Svelte dashboard |
| `docs/**` | Authoring references and project notes |

## Commands

```bash
bun run doctor       # Check local runtime/env before startup
bun run tx -- check authoring
bun run tx -- new feature --id hello --name Hello --description "Hello commands"
bun run dev          # Start with watch mode
bun run start        # Build dashboard, then start once
bun test             # Run tests
bun run typecheck    # TypeScript compile check
bun run check        # Biome lint + format check, read-only
```

CI should run:

```bash
bun run check
bun run typecheck
bun test ./src
cd webapp && bun run check && bun run test && bun run build
```

## Compatibility Boundary

tx keeps one current authoring path in the README: feature folders,
`defineFeature(...)`, `command(name)`, `handlers.ts`, `component(...)`, and
`defineFeatureConfig(...)`. Older framework shapes are documented in migration
notes when needed, but new code should follow the surface above.

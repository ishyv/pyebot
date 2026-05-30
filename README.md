# tx-v2

tx-v2 is a Bun-first TypeScript framework and starter codebase for building Discord bots through code.

The goal is not visual scripting, mystery globals, or "hope Discord likes this payload" nonsense. Bot authors write normal TypeScript: feature folders, command modules, typed config, explicit persistence, and tests.

## Quick Start

Requirements:

- Bun 1.1.0 or newer
- A Discord application and bot token
- MongoDB only if you run the bundled full bot feature set

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

Use `GUILD_ID` while developing commands so Discord updates them quickly. Leave it empty when you intentionally want global command registration.

## First Bot Code

New bundled features live under `src/features/<id>/`. The framework scans
those folders at startup, so adding a feature is adding a folder with an
`index.ts` descriptor and optional `commands/` or `handlers.ts` files.

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

`defineFeature` accepts exactly `id`, `name`, `description`, and optional
`defaultEnabled`. Put commands in `commands/*.ts`, component/event handlers in
`handlers.ts`, and dashboard config in feature-owned config modules; unsupported
descriptor metadata is a type error.

```ts
// src/features/hello/commands/hello.ts
import { command } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";

export default command("hello")
  .description("Say hello")
  .help({ hints: ["Replies with a small greeting."] })
  .run(async ({ user }) =>
    v2Message(container("ok", section(`Hello, ${user.username}.`))),
  );
```

Commands use the fluent `command(name)` DSL (typed options, `.run()` returns the
response payload) — not `defineCommand` or a raw `SlashCommandBuilder`. See
`docs/framework-authoring.md` for the full surface.

tx is latest-only: old feature module objects, old env aliases, old JSON content packs, and old persisted data shapes are not supported.

## Project Map

- `src/framework/**` — active feature runtime: loader, decorators, dispatch, command/component routing, and `Ctx`.
- `src/core/**` — shared infrastructure used by the bot and bundled features: DB, logging, result/state helpers, feature config metadata, and legacy middleware context.
- `src/features/**` — bundled moderation, economy, RPG, AI, tickets, offers, automod, autoroles, admin panels, and counting features.
- `src/features/rpg/content/**` — active RPG runtime content for gathering, processing, crafting, tools, and expeditions.
- `src/content/**` — seed/catalog authoring helpers and the extended default content pack.
- `templates/starter/**` — starter project shape for new bots.
- `docs/**` — feature authoring, content/dashboard authoring, storage, and latest-only policy notes.

## Commands

```bash
bun run doctor       # Check local runtime/env before startup
bun run tx -- check authoring
bun run tx -- new feature --id hello --name Hello --description "Hello commands"
bun run dev          # Start with watch mode
bun run start        # Start once
bun test             # Run tests
bun run typecheck    # TypeScript compile check
bun run check        # Biome lint + format check (read-only)
```

CI runs the same root gates plus the embedded dashboard gates:

```bash
bun run check
bun run typecheck
bun test ./src
cd webapp && bun run check && bun run test && bun run build
```

This repository currently uses Bun as the supported runtime. Node support is not a promise yet, because pretending two runtimes are supported before one path is boringly reliable is how frameworks get cursed.

## Framework Philosophy

- Explicit metadata: feature descriptors and handler decorators produce one loader result that bootstrap validates.
- Typed failures: expected domain failures use `Result` or typed errors; unexpected exceptions are caught at framework boundaries.
- Storage boundary: the active bundled bot uses Mongo-backed `World` components and repositories.
- No hidden registration soup: features are discovered by folder, commands by `commands/*.ts`, and component/event routes by `handlers.ts`.
- Source comments explain policy and boundaries, not every obvious line of code.

## Latest-Only Policy

tx does not preserve compatibility with previous framework versions. When the framework shape changes, old authoring APIs and old data loaders are removed instead of bridged. Keep rollback through git checkpoints, not runtime compatibility branches.

Current public authoring surface:

- `defineFeature({ id, name, description, defaultEnabled })`; no gates, config, commands, handlers, or arbitrary metadata in the descriptor
- `defineCommand({ data, help, execute, autocomplete })`
- `handlers.ts` classes using `@Handle`, `@Listen`, and `@On`
- framework `Ctx` plus `component(...)` for typed component persistence
- feature toggles stored in `guild_features.overrides` by feature id
- active RPG runtime content in `src/features/rpg/content/**`
- seed item catalog in `src/content/packs/default.ts` (gameplay content in `src/features/rpg/content/**`)
- `DISCORD_TOKEN` as the single Discord token environment key

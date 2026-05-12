# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # run with hot-reload
bun start        # run without hot-reload
bun test         # run all tests
bun test <path>  # run a single test file, e.g. bun test src/core/result.test.ts
bun run typecheck
bun run check    # biome format + lint (write)
bun run fmt      # biome format only
bun run lint     # biome lint only
```

## Environment

Copy `.env.example` and fill in:

| Variable    | Purpose                                              |
|-------------|------------------------------------------------------|
| `TOKEN`     | Discord bot token (required)                         |
| `MONGO_URI` | MongoDB connection URI                               |
| `DB_NAME`   | Database name                                        |
| `CLIENT_ID` | Bot application ID (falls back to `client.user.id`)  |
| `GUILD_ID`  | Set for dev to scope slash commands to one guild     |

## Architecture

### Bootstrap (`src/index.ts`)

Sequential startup: connect MongoDB → create Discord client → register command/component routing → login → upload slash commands on `ready`. All commands are statically imported here; **adding a new command requires importing it and appending it to `ALL_COMMANDS`**.

### Core utilities (`src/core/`)

- **`Result<T>`** — every fallible operation returns `Result<T, Error>` rather than throwing. Always guard with `res.isErr()` before calling `res.unwrap()`. `unwrap()` on `Err` does NOT throw — it logs a warning and returns `undefined`.
- **`CooldownManager` / `LockSet` / `SessionManager`** — in-memory singletons. Import `cooldowns` and `locks` from `@/core/state` rather than creating new instances.
- **`createLogger(name)`** — structured logger; set `DEBUG=*` in env for verbose output.

### Database layer (`src/db/`)

`MongoStore<T>` (`src/db/store.ts`) is the generic data layer. Each instance is bound to one MongoDB collection and one Zod schema. Every document read is validated; invalid documents silently fall back to schema defaults.

Key methods: `get`, `ensure` (upsert-or-return), `patch` (partial update), `set`, `replaceIfMatch` (optimistic CAS), `find`, `updatePaths`.

For concurrent mutations use `atomicTransition()` (`src/db/transition.ts`) — a retry loop that reads → computes → commits with a conditional update, retrying on conflict.

Repositories in `src/db/repositories/` instantiate stores and add query helpers. Path alias `@/*` resolves to `src/*`.

### RPG content (`src/features/rpg/content/`)

Typed compile-time catalogs (`LOCATIONS`, `TOOLS`, `MATERIALS`, `CRAFTING_RECIPES`, `PROCESSING_RECIPES`) — each defined `as const satisfies Record<string, Def>` so IDs are derived (`type LocationId = keyof typeof LOCATIONS`). Each catalog exports a `parseXId` boundary helper to narrow untrusted Discord input once at the command/handler edge; domain functions receive typed IDs and read the constant directly.

This is the **only** RPG content source — there is no runtime content-pack loader. If JSON-based content needs to be added later, it should validate with Zod at load time and merge into the same typed records before domain code runs.

### Feature modules (`src/features/<name>/`)

Each feature follows this layout:
- `commands/<cmd>.ts` — exports `data` (slash command builder) and `execute(interaction)`, optionally `autocomplete(interaction)`.
- `handlers/<event>.ts` — button/select-menu handlers; export an `isX(customId)` predicate and a `handleX(interaction)` function. Routed in `src/index.ts`.
- Service/logic files alongside (e.g. `mutations.ts`, `market.ts`, `crafting.ts`).

**Features:** `economy` (currency, market, quests, trivia, work, inventory), `rpg` (combat, gathering, crafting, processing, equip, profile), `moderation`, `autoroles`, `ai`, `automod`, `offers`, `tickets`, `utility`.

### RPG combat (`src/features/rpg/combat/`)

- `engine.ts` — pure stateless functions, seeded RNG (Mulberry32). No side effects.
- `fight.ts` — stateful fight session management built on top of the engine.
- Fight sessions expire after `COMBAT_CONFIG.sessionTtlMinutes`; the expiry interval is registered in bootstrap via `registerFightExpiry()`.

## Code conventions

- All async functions that can fail return `Result<T, Error>` — no naked `throw` in service/repository code.
- Biome enforces double quotes, 2-space indent, 100-char line width, trailing commas.
- TypeScript strict mode is enabled (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`).

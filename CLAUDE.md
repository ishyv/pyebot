# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # run with hot-reload
bun start        # run without hot-reload
bun test         # run all tests
bun test <path>  # run a single test file, e.g. bun test src/core/result.test.ts
bun run doctor
bun run typecheck
bun run check    # biome format + lint (read-only)
bun run fmt      # biome format only
bun run lint     # biome lint only
```

## Environment

Copy `.env.example` and fill in. Required:

| Variable         | Purpose                                              |
|------------------|------------------------------------------------------|
| `DISCORD_TOKEN`  | Discord bot token                                    |
| `CLIENT_ID`      | Bot application ID (falls back to `client.user.id`)  |
| `MONGO_URI`      | MongoDB connection URI                               |
| `DB_NAME`        | Database name (defaults to `txbot` if unset)         |

Optional: `GUILD_ID` (scope slash commands to one guild in dev), `DEBUG` (any non-empty value enables debug logs), `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` (AI providers — configure at least one to use AI commands), `WEBAPP=true` + `WEBAPP_PORT` (start the bundled dashboard alongside the bot; requires `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `SESSION_SECRET`).

## Architecture

### Bootstrap (`src/index.ts` + `src/framework/`)

`src/index.ts` is intentionally tiny (~100 lines) — it loads env, creates the Discord client, calls `bootstrapFramework(client)` (in `src/framework/bootstrap.ts`), wires `interactionCreate` → `dispatch`, then logs in and pushes slash commands on `ready`.

**Features are discovered by filesystem scan, not by import list.** `loadFeatures()` (`src/framework/loader.ts`) walks `src/features/*/` and loads each folder that has an `index.ts` exporting a `FeatureDescriptor` as default. Adding a feature = dropping a folder; there is no central registry to update.

Per-feature conventions enforced by the loader (throws at boot if violated):
- `<feature>/index.ts` — default-exports a `FeatureDescriptor` (from `defineFeature`) whose `id` matches the folder name.
- `<feature>/commands/*.ts` — each file default-exports a command built with the `command(name)` DSL (see "Authoring a command" below). Tests (`*.test.ts`) are skipped.
- `<feature>/handlers.ts` — optional class whose prototype carries `@On` (framework event bus), `@Handle` (component customId routing), and `@Listen` (raw discord.js event) metadata. The framework reads metadata at boot; you do NOT register handlers in `src/index.ts`.

### Core utilities (`src/core/`)

- **`Result<T>`** — every fallible operation returns `Result<T, Error>` rather than throwing. Always guard with `res.isErr()` before calling `res.unwrap()`. `unwrap()` on `Err` does NOT throw — it logs a warning and returns `undefined`.
- **`CooldownManager` / `LockSet` / `SessionManager`** — in-memory singletons. Import `cooldowns` and `locks` from `@/core/state` rather than creating new instances.
- **`createLogger(name)`** — structured logger; set `DEBUG=*` in env for verbose output.

### Database layer (`src/db/`)

`MongoStore<T>` (`src/db/store.ts`) is the legacy Result-returning repository adapter. Existing instances must live in `src/db/repositories/**` (guarded by `src/db/mongo-store-boundary.test.ts`). New feature code should use `World`/`Ctx` components or a deliberately narrow persistence module for external constraints such as MongoDB transactions.

Marketplace create/buy/cancel now require MongoDB transaction support. Run MongoDB as a replica set or sharded cluster; standalone Mongo deployments fail market writes with `TRANSACTION_FAILED`.

Key methods: `get`, `ensure` (upsert-or-return), `patch` (partial update), `set`, `replaceIfMatch` (optimistic CAS), `find`, `updatePaths`.

For concurrent mutations use `atomicTransition()` (`src/db/transition.ts`) — a retry loop that reads → computes → commits with a conditional update, retrying on conflict.

Repositories in `src/db/repositories/` instantiate stores and add query helpers. Path alias `@/*` resolves to `src/*`.

### RPG content (`src/features/rpg/content/`)

The content modules expose live, typed maps — `LOCATIONS`, `MATERIALS`, `TOOLS`, and the recipe maps — plus a `parseXId` boundary helper per catalog (`parseLocationId`, `parseMaterialId`, `parseToolId`, `parseCraftingRecipeId`, `parseProcessingInputId`). IDs are plain `string` (e.g. `type LocationId = string`); narrow an untrusted Discord string **once** at the command/handler edge with the matching `parseXId`, then pass the typed ID inward — domain functions index the live map directly and never re-validate.

These maps are **runtime-mutable**, not compile-time constants. Static TypeScript fallback lives in `src/features/rpg/content/default-content.ts`, with item definitions shared through `src/content/packs/default-items.ts` and consumed by `DEFAULT_CONTENT_PACK.items`. The embedded dashboard validates edits with Zod and persists a snapshot to Mongo (`rpg_content.active`) that replaces the live maps. Command code can't tell whether content came from source or Mongo, which is the point. There is **no** external JSON/JSON5 content-pack loader — see `docs/content-authoring.md` and `docs/rpg-content-dashboard.md` before changing content.

### Feature modules (`src/features/<name>/`)

Each feature follows this layout:
- `index.ts` — default-exports a `FeatureDescriptor` from `defineFeature({ id, name, description, defaultEnabled? })`. Those four fields are the entire descriptor surface; anything else is a type error.
- `commands/<cmd>.ts` — default-exports a command built with the `command(name)` DSL (below).
- `handlers.ts` (optional) — default-exports a class. Methods decorated with `@On(EventClass)` listen on the framework event bus; `@Handle(prefix)` routes Discord components (buttons, selects, modals) whose `customId` starts with that prefix; `@Listen("discordEvent")` subscribes to a raw discord.js event. The framework discovers all of these via metadata at boot.
- Service/logic files alongside (e.g. `mutations.ts`, `market.ts`, `crafting.ts`).

**Features:** `adminPanels`, `ai`, `automod`, `autoroles`, `counting`, `economy` (currency, market, quests, trivia, work, inventory), `embeds` (admin-authored rich embeds + script-driven embeds), `moderation`, `offers`, `rpg` (combat, gathering, crafting, processing, equip, profile), `tickets`, `tycoon` (idle/economy operations), `utility`.

### Authoring a command (`command(name)` DSL)

Commands are built with the fluent, fully-typed `command(...)` builder from `@/framework` — there is **no** `defineCommand` and **no** raw `SlashCommandBuilder`. Declare options on the builder; the `.run()` handler receives a typed context and **returns** a Components-V2 message payload (the framework owns the reply/defer/edit lifecycle and validates the payload).

```ts
// src/features/polls/commands/poll.ts
import { command } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";

export default command("poll")
  .description("Create a poll")
  .string("question", "What are we voting on?", { required: true })
  .guildOnly()                       // narrows ctx.guild to non-null in .run
  .defer("ephemeral")                // or "public"; omit for an immediate reply
  .help({ hints: ["/work", "/profile"] })
  .run(async ({ ctx, user, options }) => {
    // options.question is typed `string` (required); user is the invoker.
    return v2Message(container("ok", section(`## ${options.question}`)));
  });
```

- Options: `.string/.integer/.boolean/.user/.channel/.role(name, description, settings?)`. `{ required: true }` makes the value non-optional in `options`.
- Subcommands: `.subcommand("name", "desc", s => s.string(...))` then `.handle("name", async (c) => { c.options /* typed to that subcommand */ })`. Group with `.group(...)`. **Never** branch on `if (c.subcommand === "x")` — see AGENTS.md "Subcommand dispatch".
- Responding: prefer returning `v2Message(...)`. For multi-step/follow-up flows use `ctx.respond.send` / `ctx.respond.fail` (returns a `Result`, never throws). Use `c.unwrap(result)` to short-circuit `.run()` with a mapped error message.
- See `docs/framework-authoring.md` for components/events and `src/features/economy/commands/balance.ts` for a minimal real example.

### RPG combat (`src/features/rpg/combat/`)

- `engine.ts` — pure stateless functions, seeded RNG (Mulberry32). No side effects.
- `fight.ts` — stateful fight session management built on top of the engine.
- Fight sessions expire after `COMBAT_CONFIG.sessionTtlMinutes`; the expiry interval is registered in bootstrap via `registerFightExpiry()`.

## Code conventions

- **Error model:** repositories and infrastructure return `Result<T, Error>` for expected failures (guard with `res.isErr()`). Domain services may instead `throw` a **typed** error (e.g. `MutationError` with a `code` union) that is caught at the interaction boundary — see `src/features/economy/mutations.ts`. What's banned is the *untyped* `throw new Error("...")` for an expected domain outcome. Unexpected exceptions bubble to the framework boundary.
- Validate untrusted input once at the boundary (Zod / a `parseXId` helper), then pass typed values inward. Don't re-validate in every domain function.
- Biome enforces double quotes, 2-space indent, 100-char line width, trailing commas.
- TypeScript strict mode is enabled (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`).

**Engineering values, the required pre-edit diagnosis note, the banned `if (subcommand === ...)` pattern, commenting rules, and the "write human-looking code" checklist live in [`AGENTS.md`](./AGENTS.md). Read it before changing code.** Deeper references: `docs/ai/engineering-principles.md`, `docs/ai/typescript-typing-and-validation.md`.

## Workflow

- **Work directly on `main`** — do not create feature branches unless explicitly asked.
- **Commit after each significant change** (one logical step per commit), running `bun run typecheck`, `bun run check`, and the relevant `bun test` before committing.

# tx-v2

tx-v2 is a Bun-first TypeScript framework and starter codebase for building Discord bots through code.

The goal is not visual scripting, mystery globals, or "hope Discord likes this payload" nonsense. Bot authors write normal TypeScript: classes, decorators, functions, typed config, explicit storage, and tests.

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
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_client_id
GUILD_ID=optional_dev_guild_id

# Optional for starter bots, required for the bundled full bot.
MONGO_URI=mongodb://localhost:27017
DB_NAME=txbot
```

Use `GUILD_ID` while developing commands so Discord updates them quickly. Leave it empty when you intentionally want global command registration.

## First Bot Code

New framework code should use `createBot` and decorated feature classes:

```ts
import { Feature, SlashCommand, createBot, MemoryStorageAdapter } from "@/framework";

@Feature({ id: "hello", intents: ["Guilds"] })
class HelloFeature {
  @SlashCommand({ name: "hello", description: "Say hello" })
  async hello(interaction: import("discord.js").ChatInputCommandInteraction) {
    await interaction.reply("Hello.");
  }
}

const bot = createBot({
  name: "my-bot",
  features: [HelloFeature],
  storage: new MemoryStorageAdapter(),
});

await bot.start();
```

The current bundled tx-v2 bot still lives under `src/features/**`. It is being migrated through the same framework runtime; legacy feature modules are supported during the transition.

## Project Map

- `src/framework/**` — public framework runtime: decorators, `createBot`, storage adapters, doctor checks.
- `src/core/**` — legacy compatibility core used by the bundled bot while migration continues.
- `src/features/**` — bundled moderation, economy, RPG, AI, tickets, offers, automod, autoroles, admin panels, and counting features.
- `src/content/**` — typed RPG content pack runtime and authoring helpers.
- `templates/starter/**` — starter project shape for new bots.
- `docs/**` — feature authoring, content authoring, storage, and migration notes.

## Commands

```bash
bun run doctor       # Check local runtime/env before startup
bun run dev          # Start with watch mode
bun run start        # Start once
bun test             # Run tests
bun run typecheck    # TypeScript compile check
bun run check        # Biome format+lint check
```

This repository currently uses Bun as the supported runtime. Node support is not a promise yet, because pretending two runtimes are supported before one path is boringly reliable is how frameworks get cursed.

## Framework Philosophy

- Explicit metadata: decorators collect metadata; startup compiles that into a registry and validates duplicates.
- Typed failures: expected domain failures use `Result` or typed errors; unexpected exceptions are caught at framework boundaries.
- Storage adapters: starter bots can use memory/file storage; production bots can use MongoDB.
- No hidden registration soup: features declare commands, components, events, config, intents, and jobs in one place.
- Source comments explain policy and boundaries, not every obvious line of code.

## Current Migration State

Implemented now:

- Baseline checkpoint branch.
- `bun run doctor`.
- Decorator-class feature API.
- `createBot` runtime bridge.
- Memory and file storage adapters.
- Legacy feature-module compatibility.

Still being migrated:

- Converting every bundled feature to decorated classes.
- Moving all repository code onto storage adapters.
- Splitting the largest legacy feature files.

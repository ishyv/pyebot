# Full Bot Rewrite — Design Spec

**Date:** 2026-03-28
**Status:** Approved

---

## Context

The current bot (`tx`) has accumulated severe technical debt that makes it unstable and painful to work with:

- 57,000+ lines of TypeScript across `src/`
- Economy module alone: 31,880 lines in 124 files
- Monolithic services (market/service.ts: 1,732 lines; minigames/service.ts: 1,255 lines)
- Scattered global state — cooldown Maps, session Maps defined inside individual service files
- 3-layer event system (Seyfert event → handler → hook → listener, 50+ files, non-deterministic load order)
- Duplicated utility functions reimplemented in 8+ places (ID builders, correlation IDs, currency formatters)
- Repository god-objects managing 4–5 unrelated entities in a single file
- Framework: Seyfert (niche, limited community, non-standard)

This spec describes a **greenfield rewrite** with the same feature set but a sane, readable architecture.

---

## Stack

| Layer | Decision |
|-------|----------|
| Discord framework | **Discord.js v14** (from Seyfert) |
| Runtime | **Bun 1.2** (keep) |
| Database | **MongoDB native driver** (keep) |
| Validation | **Zod 4** (keep) |
| Language | **TypeScript strict** (keep) |
| Linting/Format | **Biome** (keep) |

---

## Architecture

**Pattern: Feature Modules + Direct Discord.js**

Each feature is a self-contained folder. Discord.js events are registered directly — no intermediary hook bus. Services are plain exported async functions. All shared runtime state lives in one place.

### Directory Structure

```
src/
├── core/
│   ├── client.ts           # Discord.js Client factory
│   ├── db.ts               # MongoDB connection singleton
│   ├── result.ts           # Result<T, E> type
│   ├── state.ts            # Centralized ephemeral state (cooldowns, sessions, locks)
│   └── logger.ts           # Logging
├── db/
│   ├── store.ts            # Generic MongoStore<T> with Zod validation
│   ├── transition.ts       # Optimistic CAS (runUserTransition pattern)
│   ├── schemas/            # Zod schema definitions per collection
│   └── repositories/       # One file per Mongo collection
│       ├── users.ts
│       ├── guilds.ts
│       ├── rpg.ts
│       └── economy.ts
├── utils/
│   ├── ids.ts              # All correlation/composite ID builders
│   ├── currency.ts         # Currency formatting & conversion
│   ├── time.ts             # Cooldown time helpers
│   └── embeds.ts           # Shared embed builder utilities
├── features/
│   ├── economy/
│   ├── rpg/
│   ├── moderation/
│   ├── automod/
│   ├── tickets/
│   ├── autoroles/
│   ├── ai/
│   ├── offers/
│   └── utility/
├── content/                # Content pack loader (cleaned up)
├── middleware/             # Global command guards
└── index.ts                # Bootstrap — linear, fully explicit
```

---

### Feature Module Structure

Every feature uses the same internal layout:

```
features/<feature>/
├── commands/               # Slash commands (thin input adapters)
├── handlers/               # Discord.js event handlers
├── <domain>.ts             # Service: plain exported async functions
└── repository.ts           # Data access
```

**Economy split** (31,880 lines → ~8 focused files):

```
features/economy/
├── commands/
├── handlers/
├── account.ts              # Account lifecycle
├── mutations.ts            # Currency transfers
├── minigames.ts            # Coinflip, trivia, rob
├── market.ts               # Listings: create, buy, cancel, browse
├── achievements.ts         # Achievement tracking
├── quests.ts               # Quest lifecycle
└── repository.ts
```

**RPG:**

```
features/rpg/
├── commands/
├── handlers/
├── combat/
│   ├── engine.ts           # Seeded RNG combat (port from current — correct)
│   └── fight.ts            # Fight orchestration
├── gathering.ts
├── crafting.ts
├── quests.ts
└── repository.ts
```

---

### Design Rules

1. **No class-based services.** Export plain async functions.
   ```ts
   // Good
   export async function getBalance(userId: string, currencyId: string): Promise<Result<number>> {}
   // Bad
   class AccountService { async getBalance(...) {} }
   ```

2. **Commands are thin.** Validate input → call service function → send response. Nothing else.

3. **One file, one responsibility.** `mutations.ts` handles transfers. `account.ts` handles lifecycle. They don't bleed into each other.

4. **No inline helper accumulation.** Shared helpers go to `utils/`. Private helpers are named functions at the top of the file, not buried 200 lines in.

5. **File size target: under 400 lines.** Approaching 400 lines is a signal to split.

---

### Event Handling

**No more 3 layers.** Direct Discord.js event registration, explicit wiring in `index.ts`.

```ts
// src/features/ai/handlers/messageCreate.ts
export function register(client: Client): void {
  client.on('messageCreate', async (msg) => {
    if (shouldRespond(msg)) await handleAiResponse(msg);
  });
}

// src/index.ts
aiHandlers.register(client);
autoroleHandlers.register(client);
// ...
```

No `autoRequireDirectory`. No hooks. No event bus. Every listener is explicit and traceable.

---

### Centralized State

All runtime state in `src/core/state.ts`. No scattered Maps.

```ts
export const cooldowns = new CooldownManager();
export const sessions = new SessionManager();   // trivia, etc.
export const locks = new LockSet();             // claim-in-flight, etc.
```

Replaces: `activeTriviaSessions` (minigames), `listingCooldown`/`buyCooldown` (market), `claimInFlight` (rpg/quests), `responseCache` (forumAutoReply).

---

### Shared Utilities

| File | Replaces |
|------|----------|
| `utils/ids.ts` | `buildCorrelation()`, `buildProgressId()`, `buildUnlockedId()` across 8+ files |
| `utils/currency.ts` | `getCurrencyAmount()`, `makeCurrencyValue()` in minigames + mutations |
| `utils/time.ts` | Cooldown expiry logic in market + minigames |
| `utils/embeds.ts` | The 873-line `account/embeds.ts` |

---

### Data Layer

**Keep and port:**
- `MongoStore<T>` generic store with Zod validation
- Optimistic CAS / `runUserTransition` pattern
- `Result<T, E>` type
- Zod schemas

**Fix:**
- Transfer atomicity: use MongoDB multi-document transactions (replica set required) instead of best-effort rollback
- Repository god-objects: one file per collection, max ~200 lines

---

### Bootstrap Order

```
1. Load env
2. Connect MongoDB
3. Load content packs
4. Create Discord.js client
5. Register middleware
6. Register all event handlers (explicit)
7. Login
8. On ready: upload commands
```

---

## What Gets Ported vs Rewritten

| Component | Action |
|-----------|--------|
| `src/db/mongo-store.ts` | Port |
| `src/db/atomic-transition.ts` | Port |
| `src/utils/result.ts` | Port |
| `src/modules/rpg/combat/engine.ts` | Port |
| `src/modules/content/` | Port + clean (remove singleton) |
| Zod schemas | Port + update |
| All service classes | Rewrite as plain functions |
| Event system (hooks/handlers/listeners) | Rewrite as direct djs handlers |
| Economy repositories | Rewrite (split god-objects) |
| `autoRequireDirectory` | Delete |
| All inline helpers | Extract to utils/ |
| `src/modules/economy/account/embeds.ts` | Rewrite (split by feature) |

---

## Implementation Order

1. Scaffold — new project, tsconfig, biome, package.json, djs
2. Core layer — client, db, result, state, logger
3. Data layer — MongoStore, CAS, Zod schemas, per-collection repositories
4. Utils — ids, currency, time, embeds
5. Content — clean pack loader
6. Economy feature — account, mutations, market, minigames, achievements, quests + commands
7. RPG feature — combat, gathering, crafting, quests + commands
8. Moderation — ban, kick, warn, automod + commands
9. Remaining features — autoroles, tickets, AI, offers, utility
10. Middleware — global guards
11. Integration — wire index.ts, end-to-end flow
12. Content pack verification

---

## Verification Criteria

- `bun run dev` starts without errors
- All slash commands register with Discord
- Economy: wallet, work, gamble, transfer work end-to-end
- RPG: fight, gather, craft work end-to-end
- Moderation: ban, kick, warn apply correctly
- Events: AI triggers on message, autoroles apply on join
- Content packs load without validation errors
- No runtime Maps outside `core/state.ts`
- No files exceed 400 lines

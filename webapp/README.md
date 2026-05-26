# tx-moderation-webapp

Self-hosted SvelteKit dashboard for the **tx** Discord bot. Manage server-side
config (moderation, automod, economy, channels, roles, features) from a web UI
instead of slash commands, with live data piped from the bot through an
in-memory bridge.

> ⚠ **Deployment model.** The dashboard runs **inside the bot's Node process**
> via an in-memory bridge (`globalThis.__txBotBridge__`). Standalone deployment
> (e.g. Vercel + a separate bot host) is **not supported** — the source lives
> in its own repo for cleanliness, but the runtime is co-located. See
> [Architecture](#architecture) for details.

---

## Features

- **Discord OAuth login** with `identify guilds` scope; per-user sessions stored
  in MongoDB and encrypted with a server secret.
- **Server picker** at `/guilds` that shows every guild where the user has
  `MANAGE_GUILD` or `Administrator`, with bot-presence enrichment.
- **Per-guild dashboards** for moderation, automod, economy, channels, roles,
  and feature toggles. All writes go through the bridge into the bot's MongoDB
  layer; the bot's services validate before persisting.
- **RPG content editor** at `/rpg` (opt-in, see below) for editing the bot's
  active Mongo-backed RPG content snapshot via the live bridge.
- **Live event feed** at `/api/events` (SSE) that mirrors bot events to the
  dashboard, e.g. config changes propagate immediately to all open tabs.

---

## Quick start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (the dashboard and the bot both use it)
- A MongoDB you can write to (Atlas or a local `mongod`)
- A Discord application — create one at
  <https://discord.com/developers/applications>
- The **tx bot** repo checked out (the dashboard mounts on the bot's HTTP
  listener; see [Architecture](#architecture))

### 1. Discord setup

In the Developer Portal for your application:

- **OAuth2 → Redirects**: add `http://127.0.0.1:4000/auth/discord/callback`
  (or whatever you set as `DISCORD_REDIRECT_URI`).
- **OAuth2 → Default Authorization Link**: `client_id` + `bot applications.commands`
  scope, `Administrator` permission (the bot needs broad perms; lock it down
  later if you prefer).
- Copy the **Client ID** and **Client Secret**.

### 2. Configure

```bash
# Fill in DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, MONGO_URI, SESSION_SECRET
# (SESSION_SECRET: `openssl rand -base64 48`)
```

### 3. Install & build

```bash
bun install
bun run build       # produces build/handler.js (consumed by the bot)
```

### 4. Run the bot with the dashboard

From the bot repo (this dashboard expects to live as a sibling directory under
the bot's working tree — see [Architecture](#architecture)):

```bash
WEBAPP=true bun dev
```

The bot will mount the dashboard's SvelteKit handler on its HTTP listener
(default port `4000`). Open <http://127.0.0.1:4000/login>.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URI` | ✓ | MongoDB connection (sessions, optionally bot data) |
| `DB_NAME` | ✓ | Database name (default suggestion: `tx`) |
| `DISCORD_CLIENT_ID` | ✓ | OAuth client ID from Developer Portal |
| `DISCORD_CLIENT_SECRET` | ✓ | OAuth client secret |
| `DISCORD_REDIRECT_URI` | ✓ | Must match a redirect URI in the Discord app |
| `SESSION_SECRET` | ✓ | HMAC secret for session cookies — rotate to invalidate all sessions |
| `BOT_OWNER_IDS` | optional | Comma-separated Discord user IDs allowed to edit `/rpg`. Unset → `/rpg` returns 403 (fail-closed) |
| `DEBUG_GUILDS` | optional | Set to `1` for verbose `[guilds]` breadcrumbs on the server picker |


---

## Architecture

```
                                     ┌─────────────────────────────┐
                                     │ tx-bot (Node process)       │
  ┌────────────┐  Discord events     │ ┌─────────────────────────┐ │
  │  Discord   │ ──────────────────► │ │ Discord.js client       │ │
  │   API      │ ◄────── REST ────── │ └────────────┬────────────┘ │
  └────────────┘                     │              │              │
        ▲                            │   register   ▼              │
        │                            │ ┌─────────────────────────┐ │
        │ OAuth (browser ↔ Discord)  │ │ globalThis.__bridge__   │ │
        │                            │ │  (BotBridge interface)  │ │
        │                            │ └────────────┬────────────┘ │
        │                            │              │              │
        ▼                            │              ▼              │
  ┌────────────┐                     │ ┌─────────────────────────┐ │
  │  Browser   │ ─── HTTP/SSE ─────► │ │ SvelteKit handler       │ │
  │            │ ◄─────────────────  │ │ (this repo, built into  │ │
  └────────────┘                     │ │  build/handler.js)      │ │
                                     │ └─────────────────────────┘ │
                                     └─────────────────────────────┘
```

The bot:

1. Starts up, connects to Discord, populates `client.guilds.cache`.
2. Registers a `BotBridge` implementation on `globalThis.__txBotBridge__`
   ([`src/lib/server/bridge.ts`](src/lib/server/bridge.ts)).
3. Imports this repo's built handler and mounts it on its HTTP listener.

The dashboard:

1. Runs SvelteKit server-side load functions in the same Node process.
2. Calls `getBridge()` to talk to the bot synchronously (no HTTP between the
   two).
3. Subscribes to `bridge.events` to push live updates over SSE.

This is why the dashboard cannot run standalone: without the bot registering
the bridge, every `/guilds/**` loader throws "Bot bridge not registered."

### The `/rpg` route specifically

`/rpg` edits the bot's active RPG content snapshot through the same in-process
bridge as the rest of the dashboard. The bot validates and persists that
snapshot to Mongo as `rpg_content.active`, then refreshes the live runtime maps.

The source pack at `src/content/packs/default.ts` is seed/catalog authoring
data. It is not edited by this dashboard route. Gate `/rpg` with
`BOT_OWNER_IDS` (empty → 403 for all) to keep it out of view.

---

## Scripts

```bash
bun run dev        # Vite dev server (standalone — bridge will not be available)
bun run build      # Production build → build/handler.js
bun run preview    # Preview the production build
bun run check      # svelte-kit sync + svelte-check (type + reactivity checks)
bun run test       # vitest (currently no test files)
```

---

## Project layout

```
src/
  app.css, app.html        — global styles + HTML shell
  hooks.server.ts          — session reader; redirects unauthenticated users
  lib/
    components/            — UI components (ChannelSelect, EventFeed, GuildShell)
    server/
      access.ts            — per-guild authz against the user's session
      auth.ts              — env validation + Discord permission helpers
      bridge.ts            — wrapper around globalThis.__txBotBridge__
      config-path.ts       — dot-path helpers for nested config updates
      db.ts                — MongoDB connection + session collection
      discord.ts           — Discord REST helpers (OAuth flow only)
      oauth.ts             — OAuth state signing + URL builder
      rpg-access.ts        — BOT_OWNER_IDS allowlist for /rpg
      rpg-registry.ts      — item validation boundary for live RPG snapshot edits
      session.ts           — session create/read/refresh
  routes/
    +layout.svelte         — bare slot; per-section layouts add chrome
    +page.server.ts        — root; redirects logged-in users to /guilds
    auth/discord/          — OAuth start + callback
    login/                 — login page
    logout/                — POST /logout
    guilds/
      +page.server.ts      — server picker loader (with [guilds] logs)
      +page.svelte         — server picker UI
      [guildId]/
        +layout.server.ts  — per-guild bridge guard
        features/          — feature toggles
        moderation/        — log channel, quarantine, appeals
        automod/           — link/mention spam thresholds
        economy/           — daily/work/tax tuning
        channels/          — per-feature channel mapping
        roles/             — per-feature role mapping
    rpg/                   — RPG content editor (gated by BOT_OWNER_IDS)
    api/
      events/              — SSE event stream
      guilds/[guildId]/    — channels, roles lookups
      rpg/                 — items / recipes CRUD (gated)
      session/             — current-session probe
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and small PRs welcome; for
anything that touches the bridge contract, please open an issue first so we can
coordinate the bot-side change.

## Security

Found a vulnerability? Please read [SECURITY.md](SECURITY.md) before opening a
public issue.

## License

[MIT](LICENSE) — © 2026 Hyvnt

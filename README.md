<div align="center">

# tx-v2

**A Discord bot built for community servers. Moderation, a player-driven economy, and a full RPG progression system.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14-5865F2?logo=discord)](https://discord.js.org/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e1?logo=bun)](https://bun.sh/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb)](https://www.mongodb.com/)

</div>

---

## Features

### Moderation
- Ban, kick, mute, warn — full case history with `/cases`
- Role-based permission limits
- Auto-mod: link filtering, shorteners, domain blocklist

### Economy
- Coin balance, `/work` (hourly), `/daily` rewards
- Coinflip and trivia minigames
- Player-to-player `/transfer` and `/rob`
- **Market**: list, browse, buy, and cancel listings with a 2% fee
- Quest system: `/quest-list`, `/quest-accept`, `/quest-claim`

### RPG
A profession-based gathering and crafting loop.

**Getting started:** `/rpg-profile` — pick Miner ⛏️ or Lumberjack 🪓 to receive your starter tool.

| Command | What it does |
|---|---|
| `/gather-mine` | Pick a mine location via button UI, gather ore |
| `/gather-cutdown` | Pick a forest location via button UI, chop wood |
| `/gather-locations` | Browse all locations and see what's locked/unlocked |
| `/process` | Convert raw materials into refined goods (62% success) |
| `/craft` | Craft tools from processed materials |
| `/equip` | Equip a tool from your inventory via dropdown menu |
| `/inventory` | View your materials, processed goods, and tools |
| `/fight @user` | Challenge another player to PvP combat |
| `/rpg-quest` | Browse and track RPG quests |

**Tool tier progression:**

```
T1 starter → T2 stone → T3 copper → T4 iron
```

Each tier unlocks new gathering locations. Tools degrade with use.

### AI
- Per-channel chatbot powered by OpenAI or Gemini
- Auto-replies in configured threads

### Utility
- Ticket system
- Auto-roles on join or reaction
- `/help` — browse commands by category or look up any command individually

---

## Setup

**Requirements:** [Bun](https://bun.sh/) · MongoDB

```bash
git clone https://github.com/ishyv/pyebot.git
cd pyebot
bun install
```

Create a `.env` file:

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
MONGO_URI=mongodb://localhost:27017
DB_NAME=txbot

# Optional
GEMINI_API_KEY=...
OPENAI_API_KEY=...
```

```bash
bun start
```

**Dev (hot reload):**
```bash
bun run dev
```

**Reset test data:**
```bash
bun scripts/reset-accounts.ts          # wipe economy + RPG, keep moderation data
bun scripts/reset-accounts.ts --hard   # delete all user documents
```

---

## License

MIT.

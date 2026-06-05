# Entity-Model Migration Status

Shared coordination board for migrating feature **state** to the entity-component
model. Follow [`docs/feature-migration-playbook.md`](./docs/feature-migration-playbook.md).

**How to use this file (every agent):**
1. Pick a unit whose status is `⬜ todo`.
2. **Before writing any code**, change its status to `🚧 <your-name> <date>` and commit
   *that single edit*. This claims the unit so no one else picks it.
3. Do the migration per the playbook.
4. When green and committed, set the status to `✅ <date> <commit>`.
5. Never edit another unit's row.

Status legend: `⬜ todo` · `🚧 in-progress` · `✅ done`
Difficulty: `easy` (one user component) · `medium` (a few, or a small repo) ·
`hard` (synthetic entity kind, transactions, or webapp/CLI surfaces).

## Units

| Unit | State to migrate (collection) | Likely entity kind | Difficulty | Status |
|---|---|---|---|---|
| economy/wallet | `UserCurrency` (`user_currencies`), `EconomyAccount` (`economy_accounts`) | `User` | medium | ⬜ todo |
| economy/quests | `QuestProgress` (`quest_progress`) | `User` (id may be `userId:questId` — confirm) | medium | ⬜ todo |
| economy/achievements | `AchievementProgress` (`achievement_progress`), `UnlockedAchievements` (`unlocked_achievements`) | `User` (confirm id shape) | medium | ⬜ todo |
| rpg/profile | `RpgProfile` (`rpg_profiles`) | `User` | medium | ✅ 2026-06-05 2014412 |
| rpg/inventory | `UserInventory` (`user_inventories`) | `User` | easy | ✅ 2026-06-05 95fae86 |
| tycoon | `UserFactory` (`user_factories`) | `User` | medium | ✅ 2026-06-05 bd3a6bc |
| moderation/sanctions | `UserSanctions` (`user_sanctions`) | `User` | medium | 🚧 Vey 2026-06-05 |
| moderation/banned-images | `BannedImage` (`banned_images`) | `Guild` or synthetic (repo + webapp + CLI surfaces) | hard | ⬜ todo |
| tickets | `UserTickets` (`user_tickets`), `Ticket` (`tickets`) | `User` + new `Ticket` kind | hard | ⬜ todo |
| autoroles | `AutoroleRule` (`autorole_rules`), `TimedAutoroleGrant` (`timed_autorole_grants`), `TempRoleGrant` (`temp_role_grants`) | `Guild` + synthetic grant ids (confirm) | hard | ⬜ todo |
| scripts | `ScriptDefinition` (`scripts`) | `Guild` or synthetic script id (confirm) | medium | ⬜ todo |
| offers/market | `MarketListing` (`market_listings`) | new `MarketListing` kind — **uses MongoDB transactions** (`src/db/transition.ts`, `market.ts`); migrate to `ctx.transaction` | hard | ⬜ todo |

> The "likely entity kind" column is a hint. Confirming the entity kind from the
> real id space is **step 1** of every migration (playbook §1).

## Do NOT migrate (config / kept)

These are **not** state and must stay where they are:

- `GuildFeatures` (`guild_features`) — feature toggles; standalone, no duplicate.
- All guild-document config slices (`ai`, `automod`, `channels`, `economy`,
  `moderation`, `roles`, `reputation`, `tops`, `offersConfig`, `counting`,
  `forumAutoReply`) — owned by the config system (`defineFeatureConfig` + `guildStore`).
- Anything edited through the `/admin` panel.

See [`docs/entity-vs-config-storage.md`](./docs/entity-vs-config-storage.md).

## Deferred / optional

- Guild runtime state currently on the guild doc (`nextCaseId`, `pendingTickets`)
  could move to entity components later, but it works today and is low value — not a
  starter unit.

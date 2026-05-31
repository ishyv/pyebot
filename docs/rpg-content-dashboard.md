# RPG Content Dashboard

The supported UI for editing RPG content is the embedded dashboard route at
`webapp/src/routes/rpg`. It runs inside the bot process, uses the in-process
bridge in `src/webapp/bot-bridge/rpg-content.ts`, and persists validated
snapshots to Mongo as `rpg_content.active`.

`src/features/rpg/content/default-content.ts` is the source-controlled fallback
snapshot. `src/content/packs/default-items.ts` is the shared built-in item seed,
and `src/content/packs/default.ts` exposes those items as the authoring pack
(items only since 2026-05-27).
Edit those TypeScript files in normal source changes when changing fallback
content.
Do not add another source-pack editor unless the runtime model is deliberately
changed first.

Useful checks:

```bash
bun test src/webapp/bot-bridge.test.ts
cd webapp && bun run check && bun run test && bun run build
```

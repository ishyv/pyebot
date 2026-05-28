# RPG Content Dashboard

The supported UI for editing RPG content is the embedded dashboard route at
`webapp/src/routes/rpg`. It runs inside the bot process, uses the in-process
bridge in `src/webapp/bot-bridge/rpg-content.ts`, and persists validated
snapshots to Mongo as `rpg_content.active`.

`src/content/packs/default.ts` remains source-controlled seed data (items only
since 2026-05-27).
Edit that file in normal TypeScript changes when changing the built-in catalog.
Do not add another source-pack editor unless the runtime model is deliberately
changed first.

Useful checks:

```bash
bun test src/webapp/bot-bridge.test.ts
cd webapp && bun run check && bun run test && bun run build
```

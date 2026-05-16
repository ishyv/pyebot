# Application Emoji Assets

This directory holds source images for the bot's application-owned emojis.

## Why

The `GLYPHS` table in [`../../src/ui/glyphs.ts`](../../src/ui/glyphs.ts) is the
single visual vocabulary used by every Components V2 view. Ship-time it holds
unicode fallbacks. After [`scripts/glyphs-sync.ts`](../../scripts/glyphs-sync.ts)
runs, the values are rewritten in place to `<:name:id>` (or `<a:name:id>` for
animated) strings pointing at emojis uploaded to the Discord application.

Application emojis render identically on every guild the bot is in, regardless
of that guild's emoji slot count, and are crisper on mobile than unicode
block-drawing characters.

## File naming

Each file's basename must match `<category>_<key>` exactly (lowercase). The
keys come from the `GLYPHS` table:

```
GLYPHS.severity.high  →  assets/glyphs/severity_high.png
GLYPHS.status.loading →  assets/glyphs/status_loading.gif    (animated)
GLYPHS.bar.full       →  assets/glyphs/bar_full.png
```

Accepted extensions: `.png`, `.gif`, `.jpg`. `.gif` files upload as animated.

Recommended source size: 128×128 PNG (Discord re-encodes to 96×96).

## Running sync

```bash
bun run scripts/glyphs-sync.ts
```

Required environment: `TOKEN` (bot token) and `CLIENT_ID` (application id).
The script is idempotent — running with no new assets is a no-op.

After a successful run, commit the updated `src/ui/glyphs.ts` alongside any
new asset files.

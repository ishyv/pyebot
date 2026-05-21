# Contributing

Thanks for considering a contribution! This repo is small and the maintainer
budget is one person, so the bar for inclusion is:

1. The change is genuinely useful to a self-hoster (not just your fork).
2. The diff is reviewable in one sitting.
3. It doesn't break the runtime contract with the bot (the `BotBridge`
   interface in [`src/lib/server/bridge.ts`](src/lib/server/bridge.ts)).

## Before you start

- **For anything beyond a typo or one-line fix**, please open an issue first.
  Bridge changes especially need coordination with the bot repo.
- The dashboard cannot be developed in isolation from the bot — see the
  [Architecture](README.md#architecture) section of the README. Have the bot
  repo checked out alongside this one before you start.

## Local setup

```bash
git clone https://github.com/ishyv/tx-discord-bot-webapp.git
cd tx-discord-bot-webapp
bun install
```

You'll also need the **bot repo** checked out as a sibling directory for
`/rpg` to work and for the bridge to be registered at runtime.

## Local checks (run before pushing)

```bash
bun run check    # svelte-kit sync + svelte-check; must be 0 errors, 0 warnings
bun run build    # must succeed
bun run test     # must pass (currently no tests; PRs adding them welcome)
```

CI runs all three; PRs with warnings will be flagged.

## Code style

- **Biome / Prettier**: not configured yet — match the surrounding style.
  Two-space indent, double quotes, trailing commas, semicolons.
- **TypeScript strict mode** is on (`svelte-check` enforces). Avoid `any`,
  `// @ts-ignore`, `// @ts-expect-error` unless there's a clear reason; if
  you must, add a one-line comment explaining why.
- **No `console.log` in shipped code.** Diagnostic logs gated behind an env
  var (like `DEBUG_GUILDS=1` in [`src/routes/guilds/+page.server.ts`](src/routes/guilds/+page.server.ts))
  are fine.
- **Svelte 5 reactivity**: when seeding form state from loader props, snapshot
  with `untrack(() => data.field)` to make the intent explicit (see the
  pattern in [`src/routes/guilds/[guildId]/moderation/+page.svelte`](src/routes/guilds/[guildId]/moderation/+page.svelte)).

## Commit messages

One topic per commit. Past tense or imperative both fine. The subject line
should make sense in `git log --oneline`. The body should explain *why*, not
just *what*.

## Bridge changes

If your change adds or modifies a method on `BotBridge`, you'll also need to
update the bot's `bridge-types.ts` and its `createBridgeFromClient`
implementation. Mention this in the PR description so the bot-side change can
land at the same time.

## Reporting bugs

Open an issue with:

- What you expected to happen.
- What actually happened (with the `[guilds]` breadcrumbs from
  `DEBUG_GUILDS=1` if it's a server-list issue).
- Steps to reproduce.
- Your Node/Bun version, OS, and roughly what bot commit you're running.

## License

By contributing, you agree your work will be MIT-licensed under the same terms
as [LICENSE](LICENSE).

/**
 * The `example` feature is the canonical, runnable reference for authoring
 * bot behavior. It is NOT shipped on — `defaultEnabled: false` keeps it off in
 * every guild until an admin runs `/features enable example`. Read the four
 * files in this folder top to bottom to learn the framework:
 *
 *   index.ts     — this descriptor (the only thing the loader requires)
 *   commands/    — the `command()` DSL: options, subcommands, Components-V2 replies
 *   handlers.ts  — component routes (@Handle) and event hooks (@On / @Listen)
 *   config.ts    — dashboard-editable feature config
 *
 * It lives under `src/features/` (not `templates/`) on purpose: the loader
 * discovers it, `bun run typecheck` checks it, and `bun run dev` runs it — so it
 * cannot silently drift from the real API the way a copy under templates/ did.
 *
 * To start your own feature, prefer the scaffolder:
 *   bun run tx -- new feature --id polls --name Polls --description "..."
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "example", // MUST equal the folder name — the loader asserts this.
  name: "Example",
  description: "Annotated reference feature — read the source to learn the framework.",
  // Off by default. The dispatcher gates execution on this toggle, so the
  // /example command registers globally but replies "feature disabled" until
  // enabled per-guild. That round trip is itself a demonstration of the toggle.
  defaultEnabled: false,
});

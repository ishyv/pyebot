import { describe, expect, it } from "bun:test";
import type { RunContext } from "./command";
import { command } from "./command";

/**
 * Compile-time tests for the command DSL's typed run context. These assertions
 * are validated by `tsc` (via `bun run typecheck`); the runtime `it` only
 * guards that the sample builders construct. No mock-call theater.
 */

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// ─── Top-level options ───────────────────────────────────────────────────────

const topLevel = command("top")
  .description("Top-level options")
  .string("name", "Required string", { required: true })
  .string("nick", "Optional string")
  .integer("count", "Required integer", { required: true })
  .boolean("flag", "Optional boolean")
  .user("who", "Required user", { required: true })
  .run(() => undefined);

type TopCtx = RunContext<typeof topLevel>;

export type _TopLevelAssertions = [
  Expect<Equal<TopCtx["options"]["name"], string>>,
  Expect<Equal<TopCtx["options"]["nick"], string | null>>,
  Expect<Equal<TopCtx["options"]["count"], number>>,
  Expect<Equal<TopCtx["options"]["flag"], boolean | null>>,
  // Required entity option excludes null; optional one includes it.
  Expect<Equal<Extract<TopCtx["options"]["who"], null>, never>>,
  Expect<Equal<TopCtx["subcommand"], null>>,
  Expect<Equal<TopCtx["subcommandGroup"], null>>,
  Expect<Equal<TopCtx["guildId"], string | null>>,
];

// ─── guildOnly narrows guild fields ──────────────────────────────────────────

const guildScoped = command("guild")
  .description("Guild only")
  .string("note", "Optional note")
  .guildOnly()
  .run(() => undefined);

type GuildCtx = RunContext<typeof guildScoped>;

export type _GuildAssertions = [
  Expect<Equal<GuildCtx["guildId"], string>>,
  Expect<Equal<Extract<GuildCtx["guild"], null>, never>>,
  Expect<Equal<Extract<GuildCtx["member"], null>, never>>,
];

// ─── Subcommands + groups produce a discriminated union ──────────────────────

const dispatch = command("dispatch")
  .description("Subcommand dispatch")
  .subcommand("create", "Create", (s) => s.string("title", "Title", { required: true }))
  .subcommand("remove", "Remove", (s) => s.integer("id", "Id"))
  .group("admin", "Admin", (g) =>
    g.subcommand("reset", "Reset", (s) => s.boolean("confirm", "Confirm")),
  )
  .run(() => undefined);

type DispatchCtx = RunContext<typeof dispatch>;
type CreateCtx = Extract<DispatchCtx, { subcommand: "create" }>;
type RemoveCtx = Extract<DispatchCtx, { subcommand: "remove" }>;
type ResetCtx = Extract<DispatchCtx, { subcommand: "reset" }>;

export type _DispatchAssertions = [
  Expect<Equal<DispatchCtx["subcommand"], "create" | "remove" | "reset">>,
  Expect<Equal<CreateCtx["options"]["title"], string>>,
  Expect<Equal<CreateCtx["subcommandGroup"], null>>,
  Expect<Equal<RemoveCtx["options"]["id"], number | null>>,
  Expect<Equal<ResetCtx["options"]["confirm"], boolean | null>>,
  Expect<Equal<ResetCtx["subcommandGroup"], "admin">>,
];

describe("command DSL typed context", () => {
  it("constructs the sample builders used by the compile-time assertions", () => {
    expect(typeof topLevel.execute).toBe("function");
    expect(typeof guildScoped.execute).toBe("function");
    expect(typeof dispatch.execute).toBe("function");
  });
});

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
  .subcommand({
    name: "create",
    description: "Create",
    options: (s) => s.string("title", "Title", { required: true }),
  })
  .subcommand({ name: "remove", description: "Remove", options: (s) => s.integer("id", "Id") })
  .group("admin", "Admin", (g) =>
    g.subcommand({
      name: "reset",
      description: "Reset",
      options: (s) => s.boolean("confirm", "Confirm"),
    }),
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

const objectDispatch = command("object-dispatch")
  .description("Object subcommand dispatch")
  .guildOnly()
  .subcommand({
    name: "create",
    description: "Create",
    options: (s) => s.string("title", "Title", { required: true }),
    run: (c) => {
      const inlineAssertions: [
        Expect<Equal<typeof c.options.title, string>>,
        Expect<Equal<typeof c.subcommand, "create">>,
        Expect<Equal<typeof c.subcommandGroup, null>>,
        Expect<Equal<typeof c.guildId, string>>,
      ] = [true, true, true, true];
      void inlineAssertions;
      return undefined;
    },
  })
  .subcommand({
    name: "remove",
    description: "Remove",
    options: (s) => s.integer("id", "Id"),
  })
  .subcommand({
    name: "status",
    description: "Status",
    run: (c) => {
      const noOptionAssertions: [
        Expect<Equal<typeof c.options, Readonly<Record<string, never>>>>,
        Expect<Equal<typeof c.guildId, string>>,
      ] = [true, true];
      void noOptionAssertions;
      return undefined;
    },
  })
  .group("admin", "Admin", (g) =>
    g.subcommand({
      name: "reset",
      description: "Reset",
      options: (s) => s.boolean("confirm", "Confirm"),
      run: (c) => {
        const groupAssertions: [
          Expect<Equal<typeof c.options.confirm, boolean | null>>,
          Expect<Equal<typeof c.subcommand, "reset">>,
          Expect<Equal<typeof c.subcommandGroup, "admin">>,
          Expect<Equal<typeof c.guildId, string>>,
        ] = [true, true, true, true];
        void groupAssertions;
        return undefined;
      },
    }),
  )
  .run(() => undefined);

type ObjectDispatchCtx = RunContext<typeof objectDispatch>;
type ObjectCreateCtx = Extract<ObjectDispatchCtx, { subcommand: "create" }>;
type ObjectRemoveCtx = Extract<ObjectDispatchCtx, { subcommand: "remove" }>;
type ObjectStatusCtx = Extract<ObjectDispatchCtx, { subcommand: "status" }>;
type ObjectResetCtx = Extract<ObjectDispatchCtx, { subcommand: "reset" }>;

export type _ObjectDispatchAssertions = [
  Expect<Equal<ObjectCreateCtx["options"]["title"], string>>,
  Expect<Equal<ObjectRemoveCtx["options"]["id"], number | null>>,
  Expect<Equal<ObjectStatusCtx["options"], Readonly<Record<string, never>>>>,
  Expect<Equal<ObjectResetCtx["options"]["confirm"], boolean | null>>,
  Expect<Equal<ObjectResetCtx["subcommandGroup"], "admin">>,
  Expect<Equal<ObjectResetCtx["guildId"], string>>,
];

describe("command DSL typed context", () => {
  it("constructs the sample builders used by the compile-time assertions", () => {
    expect(typeof topLevel.execute).toBe("function");
    expect(typeof guildScoped.execute).toBe("function");
    expect(typeof dispatch.execute).toBe("function");
    expect(typeof objectDispatch.execute).toBe("function");
  });
});

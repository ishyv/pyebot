import { describe, expect, it } from "bun:test";
import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { ErrResult, OkResult } from "@/core/result";
import { command } from "./command";
import type { CommandModule, Ctx } from "./types";

class KnownCommandError extends Error {}

function fakeCtx() {
  const calls: unknown[] = [];
  return {
    calls,
    ctx: {
      respond: {
        defer: async (options?: unknown) => {
          calls.push({ method: "defer", options });
        },
        send: async (payload: unknown) => {
          calls.push({ method: "send", payload });
        },
      },
    } as unknown as Ctx,
  };
}

function fakeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "user-1" },
    guildId: "guild-1",
    guild: { id: "guild-1" },
    member: { id: "member-1" },
    options: {
      getString: (name: string) => (name === "topic" ? "graph" : null),
      getInteger: (name: string) => (name === "count" ? 3 : null),
      getBoolean: () => null,
      getUser: () => null,
      getChannel: () => null,
      getRole: () => null,
      getMentionable: () => null,
      getAttachment: () => null,
      getSubcommand: () => null,
      getSubcommandGroup: () => null,
    },
    ...overrides,
  } as never;
}

describe("command DSL", () => {
  it("emits slash JSON for options, subcommands, groups, permissions, and help metadata", () => {
    const mod = command("sample")
      .description("Sample command")
      .string("topic", "Topic to inspect", { required: true, autocomplete: true })
      .integer("count", "How many", { min: 1, max: 5 })
      .subcommand("run", "Run sample", (sub) =>
        sub.string("mode", "Mode", {
          required: true,
          choices: [
            { name: "Fast", value: "fast" },
            { name: "Careful", value: "careful" },
          ],
        }),
      )
      .group("admin", "Admin actions", (group) =>
        group.subcommand("reset", "Reset sample", (sub) => sub.boolean("confirm", "Confirm")),
      )
      .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .dmPermission(false)
      .adminOnly()
      .help({ hints: ["/help"], requires: "Manage Server" })
      .run(async () => undefined);

    expect(mod.requiresAdmin).toBe(true);
    expect((mod as unknown as CommandModule).help).toEqual({
      hints: ["/help"],
      requires: "Manage Server",
    });
    expect(mod.data.toJSON()).toMatchObject({
      name: "sample",
      description: "Sample command",
      default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
      dm_permission: false,
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "topic",
          required: true,
          autocomplete: true,
        },
        {
          type: ApplicationCommandOptionType.Integer,
          name: "count",
          min_value: 1,
          max_value: 5,
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "run",
          options: [
            {
              type: ApplicationCommandOptionType.String,
              name: "mode",
              required: true,
              choices: [
                { name: "Fast", value: "fast" },
                { name: "Careful", value: "careful" },
              ],
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.SubcommandGroup,
          name: "admin",
          options: [{ type: ApplicationCommandOptionType.Subcommand, name: "reset" }],
        },
      ],
    });
  });

  it("handles guild-only lifecycle, defers, option extraction, result unwrap, and returned responses", async () => {
    const mod = command("sample")
      .description("Sample command")
      .guildOnly()
      .defer("ephemeral")
      .string("topic", "Topic")
      .integer("count", "Count")
      .help({ hints: [] })
      .run(async ({ guildId, options, expect: unwrap }) => {
        const value = unwrap(OkResult(`${guildId}:${options.topic}:${options.count}`));
        return { content: value };
      });
    const { ctx, calls } = fakeCtx();

    await mod.execute(fakeInteraction(), ctx);

    expect(calls).toEqual([
      { method: "defer", options: { visibility: "ephemeral" } },
      { method: "send", payload: { content: "guild-1:graph:3" } },
    ]);
  });

  it("maps known errors through catch handlers and rethrows unknown errors", async () => {
    const mod = command("boom")
      .description("Boom")
      .help({ hints: [] })
      .run(async ({ expect: unwrap }) => {
        unwrap(ErrResult(new KnownCommandError("nope")));
      })
      .catch(KnownCommandError, (error) => ({
        content: error.message,
        flags: MessageFlags.Ephemeral,
      }));
    const { ctx, calls } = fakeCtx();

    await mod.execute(fakeInteraction(), ctx);
    expect(calls).toEqual([
      { method: "send", payload: { content: "nope", flags: MessageFlags.Ephemeral } },
    ]);

    const unknown = command("unknown")
      .description("Unknown")
      .help({ hints: [] })
      .run(async () => {
        throw new Error("raw");
      })
      .catch(KnownCommandError, () => ({ content: "handled" }));

    await expect(unknown.execute(fakeInteraction(), ctx)).rejects.toThrow("raw");
  });
});

import { describe, expect, it } from "bun:test";
import { MessageFlags } from "discord.js";
import type { CommandModule, LoadedFeature } from "@/framework";
import { bootstrapFramework } from "@/framework";
import { makeChatInputInteraction } from "./command-harness";

function command(
  name: string,
  execute: CommandModule["execute"],
  requiresAdmin = false,
): CommandModule {
  return {
    data: { name, toJSON: () => ({ name }) },
    help: false,
    requiresAdmin,
    execute,
  };
}

function feature(commands: CommandModule[]): LoadedFeature {
  return {
    descriptor: { id: "sample", name: "Sample", description: "Sample feature" },
    commands,
    handlers: null,
  };
}

function dependencies(features: LoadedFeature[], overrides: Record<string, boolean> = {}) {
  return {
    loadFeatures: async () => features,
    createWorld: async () =>
      ({
        bus: { on: () => undefined },
        forInteraction: () => ({
          get: async () => ({ overrides }),
          respond: { send: async () => undefined },
        }),
      }) as never,
  };
}

describe("bootstrap command dispatch", () => {
  it("rejects unknown commands without executing a feature command", async () => {
    const app = await bootstrapFramework({ on: () => undefined } as never, dependencies([]));
    const { interaction, calls } = makeChatInputInteraction({ commandName: "missing" });

    await app.dispatch(interaction);

    expect(calls.raw).toEqual([
      { method: "reply", payload: { content: "Unknown command.", flags: MessageFlags.Ephemeral } },
    ]);
  });

  it("blocks disabled features before command execution", async () => {
    let executions = 0;
    const app = await bootstrapFramework(
      { on: () => undefined } as never,
      dependencies([feature([command("sample", async () => void executions++)])], {
        sample: false,
      }),
    );
    const { interaction, calls } = makeChatInputInteraction({ commandName: "sample" });

    await app.dispatch(interaction);

    expect(executions).toBe(0);
    expect(calls.raw[0]?.payload).toEqual({
      content:
        "The **Sample** feature is disabled on this server. An admin can enable it with `/features enable sample`.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("blocks admin commands for non-admin members", async () => {
    let executions = 0;
    const app = await bootstrapFramework(
      { on: () => undefined } as never,
      dependencies([feature([command("secure", async () => void executions++, true)])]),
    );
    const { interaction, calls } = makeChatInputInteraction({
      commandName: "secure",
      isAdmin: false,
    });

    await app.dispatch(interaction);

    expect(executions).toBe(0);
    expect(calls.raw).toEqual([
      {
        method: "reply",
        payload: {
          content: "You need Manage Server permission to use this command.",
          flags: MessageFlags.Ephemeral,
        },
      },
    ]);
  });

  it("dispatches a normal command to its actual execute callback", async () => {
    let executions = 0;
    const app = await bootstrapFramework(
      { on: () => undefined } as never,
      dependencies([feature([command("sample", async () => void executions++)])]),
    );
    const { interaction } = makeChatInputInteraction({ commandName: "sample" });

    await app.dispatch(interaction);

    expect(executions).toBe(1);
  });
});

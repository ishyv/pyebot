import { describe, expect, test } from "bun:test";
import { createBot, Feature, MemoryStorageAdapter, SlashCommand } from "@/framework";
import { isRetriableDiscordStartupError } from "./bot";

describe("createBot", () => {
  test("builds a registry from decorated classes without requiring Mongo", () => {
    @Feature({ id: "starter", intents: ["Guilds"] })
    class StarterFeature {
      @SlashCommand({ name: "starter", description: "Starter command" })
      async starter() {}
    }

    const bot = createBot({
      name: "starter",
      features: [StarterFeature],
      storage: new MemoryStorageAdapter(),
      registerCommands: false,
    });

    expect(bot.registry.allFeatures().map((feature) => feature.id)).toEqual(["starter"]);
    expect(bot.registry.allCommandData()).toHaveLength(1);
  });

  test("rejects old feature module objects at startup", () => {
    expect(() =>
      createBot({
        name: "starter",
        features: [{ id: "old-module", commands: [] } as never],
        storage: new MemoryStorageAdapter(),
        registerCommands: false,
      }),
    ).toThrow("Feature source at index 0 must be a decorated class.");
  });

  test("classifies Discord gateway 5xx startup errors as retriable", () => {
    expect(
      isRetriableDiscordStartupError({ status: 504, method: "GET", url: "/gateway/bot" }),
    ).toBe(true);
    expect(
      isRetriableDiscordStartupError({ status: 401, method: "GET", url: "/gateway/bot" }),
    ).toBe(false);
  });
});

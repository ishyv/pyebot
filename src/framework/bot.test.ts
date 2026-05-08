import { describe, expect, test } from "bun:test";
import { createBot, Feature, MemoryStorageAdapter, SlashCommand } from "@/framework";

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
});

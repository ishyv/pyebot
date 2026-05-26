import { describe, expect, it } from "bun:test";
import { allCommandModules, runCommandSmokeScenario } from "./command-smoke";
import { commandSmokeScenarios } from "./command-smoke-scenarios";

describe("command smoke scenario registry", () => {
  it("has one smoke scenario for every command module", () => {
    const missing = allCommandModules
      .map((entry) => entry.command.data.name)
      .filter((name) => !commandSmokeScenarios[name]);

    expect(missing).toEqual([]);
  });

  it("validates scenario options against slash command metadata", async () => {
    for (const entry of allCommandModules) {
      const scenario = commandSmokeScenarios[entry.command.data.name];
      expect(scenario, `${entry.command.data.name} smoke scenario missing`).toBeDefined();
      if (scenario) await runCommandSmokeScenario(entry, scenario);
    }
  });
});

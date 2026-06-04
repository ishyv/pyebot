import { describe, expect, it } from "bun:test";
import { ApplicationCommandOptionType } from "discord.js";
import type { CommandModule, LoadedFeature } from "@/framework";
import {
  buildCommandCatalog,
  getCommandMeta,
  getCommandsForFeature,
  getHints,
  installCommandCatalog,
} from "./command-registry";

function command(
  name: string,
  description: string,
  help: CommandModule["help"],
  options: unknown[] = [],
): CommandModule {
  return {
    data: {
      name,
      toJSON: () => ({ name, description, options }),
    },
    help,
    execute: async () => {},
  };
}

function feature(id: string, commands: CommandModule[]): LoadedFeature {
  return {
    descriptor: {
      id,
      name: id.toUpperCase(),
      description: `${id} feature`,
      defaultEnabled: true,
    },
    commands,
    handlers: null,
    registrations: [],
  };
}

describe("command catalog", () => {
  it("indexes visible commands under their owning feature", () => {
    const catalog = buildCommandCatalog([
      feature("rpg", [
        command("fight", "Challenge another user", { hints: ["/rpg-profile"] }),
        command("debug-rpg", "Internal debug command", false),
        command("rpg-profile", "View an RPG profile", { hints: [] }),
      ]),
    ]);

    installCommandCatalog(catalog);

    expect(getCommandsForFeature("rpg").map((entry) => entry.name)).toEqual([
      "fight",
      "rpg-profile",
    ]);
    expect(getCommandMeta("fight")?.featureId).toBe("rpg");
    expect(getHints("fight")).toBe("💡 /rpg-profile");
    expect(getCommandMeta("debug-rpg")).toBeNull();
  });

  it("derives argument help from slash command JSON", () => {
    const catalog = buildCommandCatalog([
      feature("rpg", [
        command("process", "Process raw materials", { hints: [] }, [
          {
            type: ApplicationCommandOptionType.String,
            name: "material",
            description: "Raw material ID",
            required: true,
          },
        ]),
      ]),
    ]);

    installCommandCatalog(catalog);

    expect(getCommandMeta("process")?.args).toEqual([
      {
        name: "material",
        description: "Raw material ID",
        required: true,
      },
    ]);
  });

  it("rejects command modules that do not declare help metadata", () => {
    const missingHelp = {
      data: {
        name: "oops",
        toJSON: () => ({ name: "oops", description: "Oops" }),
      },
      execute: async () => {},
    } as unknown as CommandModule;

    expect(() => buildCommandCatalog([feature("utility", [missingHelp])])).toThrow(
      "must declare help metadata",
    );
  });

  it("rejects stale slash-command hints", () => {
    expect(() =>
      buildCommandCatalog([
        feature("rpg", [command("fight", "Challenge another user", { hints: ["/missing"] })]),
      ]),
    ).toThrow("unknown command hint");
  });
});

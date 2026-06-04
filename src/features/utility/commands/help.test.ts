import { describe, expect, it } from "bun:test";
import type { CommandModule, LoadedFeature } from "@/framework";
import { buildCommandCatalog, installCommandCatalog } from "@/utils/command-registry";
import helpCommand from "./help";

function command(name: string, description: string): CommandModule {
  return {
    data: {
      name,
      toJSON: () => ({ name, description }),
    },
    help: { hints: [] },
    execute: async () => {},
  };
}

function feature(id: string, name: string, commands: CommandModule[]): LoadedFeature {
  return {
    descriptor: {
      id,
      name,
      description: `${name} feature`,
      defaultEnabled: true,
    },
    commands,
    registrations: [],
  };
}

function installSampleCatalog(): void {
  installCommandCatalog(
    buildCommandCatalog([
      feature("rpg", "RPG", [
        command("fight", "Challenge another user"),
        command("rpg-profile", "View an RPG profile"),
      ]),
      feature("utility", "Utility", [command("help", "Browse command help")]),
    ]),
  );
}

function payloadText(payload: unknown): string {
  return JSON.stringify(payload);
}

describe("/help command", () => {
  it("autocompletes feature ids and command names from the installed catalog", async () => {
    installSampleCatalog();
    const responses: Array<Array<{ name: string; value: string }>> = [];

    await helpCommand.autocomplete?.(
      {
        options: { getFocused: () => "r" },
        respond: async (choices: Array<{ name: string; value: string }>) => {
          responses.push(choices);
        },
      } as never,
      {} as never,
    );

    expect(responses[0]?.map((choice) => choice.value)).toEqual(["rpg", "rpg-profile"]);
  });

  it("renders root help from feature-owned categories", async () => {
    installSampleCatalog();
    const edits: unknown[] = [];

    await helpCommand.execute(
      {
        options: { getString: () => null },
      } as never,
      {
        respond: {
          defer: async () => {},
          send: async (payload: unknown) => {
            edits.push(payload);
          },
        },
      } as never,
    );

    const text = payloadText(edits[0]);
    expect(text).toContain("RPG");
    expect(text).toContain("Utility");
  });

  it("renders command details with description and hints", async () => {
    installCommandCatalog(
      buildCommandCatalog([
        feature("rpg", "RPG", [
          {
            ...command("rpg-profile", "View an RPG profile"),
            help: { hints: ["/fight"] },
          },
          command("fight", "Challenge another user"),
        ]),
      ]),
    );
    const edits: unknown[] = [];

    await helpCommand.execute(
      {
        options: { getString: () => "rpg-profile" },
      } as never,
      {
        respond: {
          defer: async () => {},
          send: async (payload: unknown) => {
            edits.push(payload);
          },
        },
      } as never,
    );

    const text = payloadText(edits[0]);
    expect(text).toContain("/rpg-profile");
    expect(text).toContain("View an RPG profile");
    expect(text).toContain("/fight");
  });
});

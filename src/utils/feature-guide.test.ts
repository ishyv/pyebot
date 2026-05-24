import { describe, expect, it } from "bun:test";
import { ApplicationCommandOptionType } from "discord.js";
import { Handle, Listen, On } from "@/framework/decorators";
import type { CommandModule, LoadedFeature } from "@/framework/types";
import { buildGuideGraph } from "./feature-guide";

class ReviewNeeded {
  constructor(readonly id: string) {}
}

class GuideTestHandlers {
  @Listen("messageCreate")
  async onMessageCreate() {}

  @On(ReviewNeeded)
  async onReviewNeeded() {}

  @Handle("guide:test:")
  async onGuideButton() {}
}

function command(
  name: string,
  description: string,
  help: CommandModule["help"],
  options: unknown[] = [],
  requiresAdmin = false,
): CommandModule {
  return {
    data: {
      name,
      toJSON: () => ({ name, description, options }),
    },
    help,
    requiresAdmin,
    execute: async () => {},
  };
}

function feature(
  id: string,
  commands: readonly CommandModule[],
  handlers: object | null = null,
  defaultEnabled = true,
): LoadedFeature {
  return {
    descriptor: {
      id,
      name: id.toUpperCase(),
      description: `${id} feature`,
      defaultEnabled,
    },
    commands,
    handlers,
  };
}

describe("feature guide graph", () => {
  it("includes visible, hidden, and admin command surfaces", () => {
    const graph = buildGuideGraph({
      features: [
        feature("automod", [
          command("automod", "Configure automatic moderation", { hints: [] }, [
            {
              type: ApplicationCommandOptionType.Subcommand,
              name: "status",
              description: "Show automod status",
              options: [
                {
                  type: ApplicationCommandOptionType.String,
                  name: "scope",
                  description: "Status scope",
                  required: true,
                },
              ],
            },
          ]),
          command("features", "Open guild feature flags", false, [], true),
        ]),
      ],
    });

    expect(graph.commands.map((entry) => entry.name)).toEqual(["automod", "features"]);
    expect(graph.commands.find((entry) => entry.name === "features")?.badges).toContain("hidden");
    expect(graph.commands.find((entry) => entry.name === "features")?.badges).toContain("admin");
    expect(graph.commands.find((entry) => entry.name === "automod")?.args).toContainEqual({
      name: "status scope",
      description: "Status scope",
      required: true,
    });
  });

  it("extracts raw events, framework events, and component routes from decorators", () => {
    const graph = buildGuideGraph({
      features: [feature("automod", [], new GuideTestHandlers())],
    });

    expect(graph.runtimeRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "discord_event",
          label: "messageCreate",
          method: "onMessageCreate",
          badges: ["event", "passive"],
        }),
        expect.objectContaining({
          kind: "framework_event",
          label: "ReviewNeeded",
          method: "onReviewNeeded",
          badges: ["event", "passive"],
        }),
        expect.objectContaining({
          kind: "component",
          label: "guide:test:",
          method: "onGuideButton",
          badges: ["component"],
        }),
      ]),
    );
  });

  it("respects guild overrides and falls back for uncategorized features", () => {
    const graph = buildGuideGraph({
      features: [feature("economy", [], null, true), feature("experimental", [], null, false)],
      overrides: { economy: false, experimental: true },
    });

    expect(graph.features.find((entry) => entry.id === "economy")).toMatchObject({
      capabilityId: "engagement",
      enabled: false,
      defaultEnabled: true,
    });
    expect(graph.features.find((entry) => entry.id === "experimental")).toMatchObject({
      capabilityId: "other",
      enabled: true,
      defaultEnabled: false,
    });
    expect(graph.capabilities.find((entry) => entry.id === "other")?.featureIds).toEqual([
      "experimental",
    ]);
  });

  it("adds curated dashboard links without inventing runtime commands", () => {
    const graph = buildGuideGraph({
      features: [feature("embeds", [])],
    });

    expect(graph.dashboardPages).toContainEqual(
      expect.objectContaining({
        featureId: "embeds",
        label: "embeds",
        path: "/embeds",
        badges: ["dashboard"],
      }),
    );
    expect(graph.features.find((entry) => entry.id === "embeds")?.dashboardPageIds).toEqual([
      "embeds:dashboard:/embeds",
    ]);
  });
});

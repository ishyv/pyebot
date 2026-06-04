import { describe, expect, it } from "bun:test";
import { ChannelType } from "discord.js";
import { Handle, Listen, On } from "@/framework/decorators";
import { registrationsFromHandlers } from "@/framework/routing/normalize";
import type { CommandModule, LoadedFeature } from "@/framework/types";
import {
  buildCapabilityGraph,
  installCapabilityGraph,
  toGuideGraphSnapshot,
} from "./capabilityGraph";
import { channelConfigField, defineFeatureConfig } from "./featureConfig";

class ReviewNeeded {
  constructor(readonly id: string) {}
}

class CapabilityHandlers {
  @Listen("messageCreate")
  async onMessageCreate() {}

  @On(ReviewNeeded)
  async onReviewNeeded() {}

  @Handle("cap:test:")
  async onComponent() {}
}

class DuplicateHandlers {
  @Handle("dup:")
  @Handle("dup:")
  async onDuplicate() {}
}

const config = defineFeatureConfig({
  fields: {
    channel: channelConfigField({
      key: "channel",
      label: "Counting channel",
      path: "counting.channelId",
      required: true,
      channelTypes: [ChannelType.GuildText],
    }),
  },
});

function command(
  name: string,
  help: CommandModule["help"],
  requiresAdmin = false,
  contract: CommandModule["contract"] | undefined = undefined,
): CommandModule {
  return {
    data: {
      name,
      toJSON: () => ({ name, description: `${name} command` }),
    },
    help,
    requiresAdmin,
    contract,
    execute: async () => {},
  };
}

function feature(
  id: string,
  commands: readonly CommandModule[],
  handlers: object | null = null,
): LoadedFeature {
  return {
    descriptor: {
      id,
      name: id.toUpperCase(),
      description: `${id} feature`,
    },
    commands,
    handlers,
    registrations: registrationsFromHandlers(handlers),
  };
}

describe("capability graph", () => {
  it("extracts commands, hints, config, and decorator routes into one graph", () => {
    const graph = buildCapabilityGraph({
      features: [
        feature("counting", [
          command("count", { hints: ["/help"], requires: "Counting channel" }, false, {
            dsl: true,
            guildOnly: true,
            defer: "ephemeral",
          }),
          command("hidden-count", false, true),
        ]),
        feature("utility", [command("help", { hints: [] })], new CapabilityHandlers()),
      ],
      configs: { counting: config },
    });

    expect(graph.features.find((entry) => entry.id === "counting")).toMatchObject({
      hasConfig: true,
      capabilityId: "engagement",
    });
    expect(graph.commands.find((entry) => entry.name === "count")).toMatchObject({
      hints: ["/help"],
      requires: "Counting channel",
      hidden: false,
      badges: ["command", "guild_only", "deferred"],
    });
    expect(graph.commands.find((entry) => entry.name === "hidden-count")?.badges).toEqual([
      "command",
      "hidden",
      "admin",
    ]);
    expect(graph.runtimeRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "discord_event", label: "messageCreate" }),
        expect.objectContaining({ kind: "framework_event", label: "ReviewNeeded" }),
        expect.objectContaining({ kind: "component", label: "cap:test:" }),
      ]),
    );
  });

  it("projects the webapp guide shape without leaking internal config maps", () => {
    const graph = buildCapabilityGraph({
      features: [feature("counting", [])],
      configs: { counting: config },
    });

    const guide = toGuideGraphSnapshot(graph);
    const [guideFeature] = guide.features;

    expect("featureConfigs" in guide).toBe(false);
    expect("loadedFeatures" in guide).toBe(false);
    expect(guideFeature).toBeDefined();
    expect("hasConfig" in guideFeature).toBe(false);
  });

  it("rejects stale command hints and duplicate graph node ids", () => {
    expect(() =>
      buildCapabilityGraph({
        features: [feature("counting", [command("count", { hints: ["/missing"] })])],
      }),
    ).toThrow("unknown command hint");

    expect(() =>
      buildCapabilityGraph({
        features: [feature("utility", [], new DuplicateHandlers())],
      }),
    ).toThrow("duplicate node id");
  });

  it("installs the graph for selector facades", () => {
    const graph = buildCapabilityGraph({ features: [feature("utility", [])] });

    installCapabilityGraph(graph);

    expect(toGuideGraphSnapshot(graph).features.map((entry) => entry.id)).toEqual(["utility"]);
    installCapabilityGraph(buildCapabilityGraph({ features: [] }));
  });
});

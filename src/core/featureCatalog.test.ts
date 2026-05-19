import { describe, expect, it } from "bun:test";
import { ChannelType } from "discord.js";
import { listConfigurableFeatures, listFeatureCatalog, setFeatureCatalog } from "./featureCatalog";
import { channelConfigField, defineFeatureConfig } from "./featureConfig";

const countingConfig = defineFeatureConfig({
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

describe("feature catalog", () => {
  it("attaches dashboard config metadata without changing feature descriptors", () => {
    setFeatureCatalog(
      [
        {
          descriptor: {
            id: "counting",
            name: "Counting",
            description: "Counting game channel.",
            defaultEnabled: false,
          },
          commands: [],
          handlers: null,
        },
        {
          descriptor: {
            id: "utility",
            name: "Utility",
            description: "Utility commands.",
          },
          commands: [],
          handlers: null,
        },
      ],
      { counting: countingConfig },
    );

    expect(listFeatureCatalog().map((feature) => feature.id)).toEqual(["counting", "utility"]);
    expect(listConfigurableFeatures().map((feature) => feature.id)).toEqual(["counting"]);
    expect(listFeatureCatalog().find((feature) => feature.id === "counting")?.config).toBe(
      countingConfig,
    );
    expect(listFeatureCatalog().find((feature) => feature.id === "utility")?.config).toBe(
      undefined,
    );

    setFeatureCatalog([]);
  });
});

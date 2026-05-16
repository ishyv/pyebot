import { describe, expect, it } from "bun:test";
import { ChannelType } from "discord.js";
import { GuildSchema } from "@/db/schemas/guild";
import {
  buildConfigFieldPatch,
  channelConfigField,
  defineFeatureConfig,
  resolveConfiguredChannel,
  validateFeatureConfig,
} from "./featureConfig";

const countingLikeConfig = defineFeatureConfig({
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

describe("feature config declarations", () => {
  it("rejects invalid field metadata", () => {
    expect(() =>
      defineFeatureConfig({
        fields: {
          channel: channelConfigField({
            key: "other",
            label: "Counting channel",
            path: "counting.channelId",
            required: true,
            channelTypes: [ChannelType.GuildText],
          }),
        },
      }),
    ).toThrow("must use matching key");
  });

  it("reports missing required guild config", () => {
    const guild = GuildSchema.parse({ _id: "guild-1" });
    const result = validateFeatureConfig(guild, countingLikeConfig);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error[0]?.path).toBe("counting.channelId");
    }
  });

  it("builds path patches for admin panel writes", () => {
    const result = buildConfigFieldPatch(countingLikeConfig, "channel", "channel-1");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap()).toEqual({ "counting.channelId": "channel-1" });
    }
  });

  it("resolves valid channels and returns null for deleted or wrong-type channels", async () => {
    const guild = GuildSchema.parse({ _id: "guild-1", counting: { channelId: "channel-1" } });
    const client = {
      channels: {
        fetch: async (id: string) => ({
          id,
          type: ChannelType.GuildText,
          guild: { id: "guild-1" },
        }),
      },
    };

    await expect(
      resolveConfiguredChannel(client as never, guild, countingLikeConfig, "channel"),
    ).resolves.toEqual(expect.objectContaining({ id: "channel-1" }));

    const deletedClient = { channels: { fetch: async () => null } };
    await expect(
      resolveConfiguredChannel(deletedClient as never, guild, countingLikeConfig, "channel"),
    ).resolves.toBeNull();

    const wrongTypeClient = {
      channels: {
        fetch: async (id: string) => ({
          id,
          type: ChannelType.GuildVoice,
          guild: { id: "guild-1" },
        }),
      },
    };
    await expect(
      resolveConfiguredChannel(wrongTypeClient as never, guild, countingLikeConfig, "channel"),
    ).resolves.toBeNull();
  });
});

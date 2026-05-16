import { describe, expect, it, mock } from "bun:test";
import { SlashCommandBuilder } from "discord.js";
import type { RuntimeFeature } from "@/core/feature";
import { ErrResult, OkResult } from "@/core/result";

mock.module("@/db/repositories/guilds", () => ({
  guildStore: {},
  ensureGuild: async () => OkResult(null),
  getGuild: async () => OkResult(null),
  patchGuild: async () => OkResult(null),
  updateGuildPaths: async () => OkResult(undefined),
}));

describe("dispatcher interaction responses", () => {
  it("edits the original deferred response when command execution throws", async () => {
    const { FeatureRegistry } = await import("@/core/registry");
    const { createDispatcher } = await import("@/core/dispatcher");

    const registry = new FeatureRegistry();
    registry.register({
      id: "test",
      commands: [
        {
          data: new SlashCommandBuilder().setName("boom").setDescription("Boom"),
          execute: async (interaction) => {
            await interaction.deferReply();
            throw new Error("kaboom");
          },
        },
      ],
    } satisfies RuntimeFeature);

    const calls: string[] = [];
    const interaction = {
      commandName: "boom",
      guildId: "guild-1",
      guild: { id: "guild-1" },
      user: { id: "user-1" },
      replied: false,
      deferred: false,
      isChatInputCommand: () => true,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isChannelSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isModalSubmit: () => false,
      async deferReply() {
        calls.push("deferReply");
        interaction.deferred = true;
      },
      async editReply() {
        calls.push("editReply");
        interaction.deferred = false;
        interaction.replied = true;
      },
      async followUp() {
        calls.push("followUp");
      },
      async reply() {
        calls.push("reply");
        interaction.replied = true;
      },
    };

    await createDispatcher(registry)(interaction as never);

    expect(calls).toEqual(["deferReply", "editReply"]);
  });

  it("uses the responder for middleware failures", async () => {
    const { FeatureRegistry } = await import("@/core/registry");
    const { createDispatcher } = await import("@/core/dispatcher");

    const registry = new FeatureRegistry();
    registry.register({
      id: "test",
      commands: [
        {
          data: new SlashCommandBuilder().setName("blocked").setDescription("Blocked"),
          middleware: [async () => ErrResult({ content: "Nope", ephemeral: true })],
          execute: async () => {
            throw new Error("should not execute");
          },
        },
      ],
    } satisfies RuntimeFeature);

    const calls: string[] = [];
    const interaction = {
      commandName: "blocked",
      guildId: "guild-1",
      guild: { id: "guild-1" },
      user: { id: "user-1" },
      replied: false,
      deferred: false,
      isChatInputCommand: () => true,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isChannelSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isModalSubmit: () => false,
      async reply() {
        calls.push("reply");
        interaction.replied = true;
      },
      async editReply() {
        calls.push("editReply");
      },
      async followUp() {
        calls.push("followUp");
      },
    };

    await createDispatcher(registry)(interaction as never);

    expect(calls).toEqual(["reply"]);
  });
});

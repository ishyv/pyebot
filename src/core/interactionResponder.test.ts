import { describe, expect, it } from "bun:test";
import { MessageFlags } from "discord.js";
import {
  classifyDiscordInteractionError,
  createInteractionResponder,
  validateInteractionPayload,
} from "@/core/interactionResponder";

function fakeInteraction(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const interaction = {
    replied: false,
    deferred: false,
    async reply(payload: unknown) {
      calls.push({ method: "reply", payload });
      interaction.replied = true;
    },
    async deferReply(payload: unknown) {
      calls.push({ method: "deferReply", payload });
      interaction.deferred = true;
    },
    async editReply(payload: unknown) {
      calls.push({ method: "editReply", payload });
      interaction.deferred = false;
      interaction.replied = true;
    },
    async followUp(payload: unknown) {
      calls.push({ method: "followUp", payload });
    },
    ...overrides,
  };
  return { interaction, calls };
}

describe("InteractionResponder", () => {
  it("replies directly when the interaction has not been acknowledged", async () => {
    const { interaction, calls } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);

    await responder.send({ content: "Ready" });

    expect(calls.map((call) => call.method)).toEqual(["reply"]);
  });

  it("edits the original response after a deferred reply", async () => {
    const { interaction, calls } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);

    await responder.defer({ visibility: "ephemeral" });
    await responder.send({ content: "Done" });

    expect(calls).toEqual([
      { method: "deferReply", payload: { flags: MessageFlags.Ephemeral } },
      { method: "editReply", payload: { content: "Done" } },
    ]);
  });

  it("uses followUp only after a completed reply already exists", async () => {
    const { interaction, calls } = fakeInteraction({ replied: true });
    const responder = createInteractionResponder(interaction as never);

    await responder.send({ content: "Second message" });

    expect(calls.map((call) => call.method)).toEqual(["followUp"]);
  });

  it("clears deferred loading state when reporting a failure", async () => {
    const { interaction, calls } = fakeInteraction({ deferred: true });
    const responder = createInteractionResponder(interaction as never);

    await responder.fail({ content: "Something failed" });

    expect(calls.map((call) => call.method)).toEqual(["editReply"]);
    expect(calls[0]?.payload).toEqual({
      content: "Something failed",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("keeps the V2 flag when reporting an ephemeral failure", async () => {
    const { interaction, calls } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);

    await responder.fail({
      components: [],
      flags: MessageFlags.IsComponentsV2,
    });

    expect(calls[0]?.payload).toEqual({
      components: [],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  });
});

describe("Discord interaction error classification", () => {
  it("classifies expired and already-acknowledged interaction failures", () => {
    expect(classifyDiscordInteractionError({ code: 10062 })).toBe("expired_interaction");
    expect(classifyDiscordInteractionError({ code: 40060 })).toBe("already_acknowledged");
  });
});

describe("interaction payload validation", () => {
  it("accepts a valid five-row component payload", () => {
    const rows = Array.from({ length: 5 }, () => ({ type: 1, components: [] }));

    expect(validateInteractionPayload({ components: rows }).isOk()).toBe(true);
  });

  it("rejects payloads with more than five top-level component rows", () => {
    const rows = Array.from({ length: 6 }, () => ({ type: 1, components: [] }));
    const result = validateInteractionPayload({ components: rows });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toContain("5");
  });

  it("allows up to ten top-level components for Components V2 payloads", () => {
    const components = Array.from({ length: 10 }, () => ({ type: 1, components: [] }));
    const result = validateInteractionPayload({
      components,
      flags: MessageFlags.IsComponentsV2,
    });

    expect(result.isOk()).toBe(true);
  });

  it("rejects more than ten top-level components even for Components V2", () => {
    const components = Array.from({ length: 11 }, () => ({ type: 1, components: [] }));
    const result = validateInteractionPayload({
      components,
      flags: MessageFlags.IsComponentsV2,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toContain("10");
  });

  it("rejects oversized content and embed arrays before Discord does", () => {
    expect(validateInteractionPayload({ content: "x".repeat(2001) }).isErr()).toBe(true);
    expect(
      validateInteractionPayload({ embeds: Array.from({ length: 11 }, () => ({})) }).isErr(),
    ).toBe(true);
  });
});

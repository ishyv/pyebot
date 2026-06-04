import { describe, expect, it } from "bun:test";
import { MessageFlags } from "discord.js";
import {
  classifyDiscordInteractionError,
  createInteractionResponder,
  validateInteractionPayload,
} from "@/core/interactionResponder";
import { container, text, v2Group } from "@/ui/v2";

function fakeInteraction(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const messages: Array<{
    method: string;
    payload?: unknown;
    edit(payload: unknown): Promise<unknown>;
    delete(): Promise<unknown>;
  }> = [];
  const makeMessage = (method: string, payload: unknown) => {
    const message = {
      method,
      payload,
      async edit(next: unknown) {
        calls.push({ method: `${method}.edit`, payload: next });
        message.payload = next;
        return message;
      },
      async delete() {
        calls.push({ method: `${method}.delete` });
      },
    };
    messages.push(message);
    return message;
  };
  const interaction = {
    replied: false,
    deferred: false,
    async reply(payload: unknown) {
      calls.push({ method: "reply", payload });
      interaction.replied = true;
      return makeMessage("reply", payload);
    },
    async deferReply(payload: unknown) {
      calls.push({ method: "deferReply", payload });
      interaction.deferred = true;
    },
    async editReply(payload: unknown) {
      calls.push({ method: "editReply", payload });
      interaction.deferred = false;
      interaction.replied = true;
      return makeMessage("editReply", payload);
    },
    async followUp(payload: unknown) {
      calls.push({ method: "followUp", payload });
      return makeMessage("followUp", payload);
    },
    ...overrides,
  };
  return { interaction, calls, messages };
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

  it("sends a V2 group as one reply plus follow-ups", async () => {
    const { interaction, calls } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);
    const group = v2Group({
      accent: "info",
      header: "Items",
      items: Array.from({ length: 39 }, (_, i) => `item ${i + 1}`),
      renderItem: (item) => text(item),
    });

    const result = await responder.sendGroup(group);

    expect(result.isOk()).toBe(true);
    expect(calls.map((call) => call.method)).toEqual(["reply", "followUp"]);
  });

  it("edits a deferred response for the first V2 group chunk", async () => {
    const { interaction, calls } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);
    const group = v2Group({
      accent: "info",
      header: "Items",
      items: Array.from({ length: 39 }, (_, i) => `item ${i + 1}`),
      renderItem: (item) => text(item),
    });

    await responder.defer({ visibility: "ephemeral" });
    const result = await responder.sendGroup(group);

    expect(result.isOk()).toBe(true);
    expect(calls.map((call) => call.method)).toEqual(["deferReply", "editReply", "followUp"]);
  });

  it("keeps follow-up chunks ephemeral after an ephemeral defer", async () => {
    const { interaction, calls } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);
    const group = v2Group({
      accent: "info",
      header: "Items",
      items: Array.from({ length: 39 }, (_, i) => `item ${i + 1}`),
      renderItem: (item) => text(item),
    });

    await responder.defer({ visibility: "ephemeral" });
    await responder.sendGroup(group);

    const followUp = calls.find((call) => call.method === "followUp");
    expect((followUp?.payload as { flags: number }).flags & MessageFlags.Ephemeral).toBe(
      MessageFlags.Ephemeral,
    );
  });

  it("replaces and deletes existing V2 group messages as the chunk count changes", async () => {
    const { interaction, calls } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);
    const initial = v2Group({
      accent: "info",
      header: "Items",
      items: Array.from({ length: 39 }, (_, i) => `item ${i + 1}`),
      renderItem: (item) => text(item),
    });
    const next = v2Group({
      accent: "info",
      header: "Items",
      items: ["item 1"],
      renderItem: (item) => text(item),
    });

    const sent = await responder.sendGroup(initial);
    expect(sent.isOk()).toBe(true);
    if (sent.isErr()) return;
    const replaced = await sent.value.replace(next);

    expect(replaced.isOk()).toBe(true);
    expect(calls.map((call) => call.method)).toEqual([
      "reply",
      "followUp",
      "reply.edit",
      "followUp.delete",
    ]);
  });

  it("returns an invalid payload error when a V2 group chunk cannot be sent", async () => {
    const { interaction } = fakeInteraction();
    const responder = createInteractionResponder(interaction as never);

    const result = await responder.sendGroup({
      chunks: [
        {
          components: [container("info", text("ok"))],
          flags: MessageFlags.IsComponentsV2,
        },
        {
          components: [],
          flags: MessageFlags.IsComponentsV2,
        },
      ],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.kind).toBe("invalid_payload");
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

  it("does not reject more than ten top-level components for Components V2", () => {
    const components = Array.from({ length: 11 }, () => ({ type: 1, components: [] }));
    const result = validateInteractionPayload({
      components,
      flags: MessageFlags.IsComponentsV2,
    });

    expect(result.isOk()).toBe(true);
  });

  it("rejects oversized content and embed arrays before Discord does", () => {
    expect(validateInteractionPayload({ content: "x".repeat(2001) }).isErr()).toBe(true);
    expect(
      validateInteractionPayload({ embeds: Array.from({ length: 11 }, () => ({})) }).isErr(),
    ).toBe(true);
  });
});

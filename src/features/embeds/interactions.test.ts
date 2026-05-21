import { describe, expect, it } from "bun:test";
import { ButtonInteraction, MessageFlags, ModalSubmitInteraction } from "discord.js";
import { OkResult } from "@/core/result";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { type EmbedInteractionDeps, handleEmbedInteraction } from "./interactions";
import { createBlankEmbedDraft } from "./model";
import { EmbedWizardRegistry, wizardId } from "./wizard";

function deps(registry: EmbedWizardRegistry, saved: EmbedConfig[] = []): EmbedInteractionDeps {
  return {
    sessions: registry,
    getEmbedConfig: async () => OkResult(null),
    findStickyForChannel: async () => OkResult(null),
    saveEmbedConfig: async (next) => {
      saved.push(next);
      return OkResult(next);
    },
    deleteEmbedConfig: async () => OkResult(true),
    invalidateSticky() {},
    log: { warn() {}, error() {} },
    now: () => new Date("2026-01-01T00:00:00Z"),
  };
}

function buttonInteraction(sessionId: string, action: string, userId = "owner-1") {
  const log: Array<{ method: string; payload?: unknown }> = [];
  const interaction = {
    customId: wizardId(sessionId, action),
    user: { id: userId },
    guildId: "guild-1",
    guild: { id: "guild-1", name: "Guild", memberCount: 5 },
    channelId: "channel-1",
    channel: { id: "channel-1", name: "general" },
    replied: false,
    deferred: false,
    reply: async (payload: unknown) => log.push({ method: "reply", payload }),
    update: async (payload: unknown) => log.push({ method: "update", payload }),
    deferReply: async (payload: unknown) => log.push({ method: "deferReply", payload }),
    editReply: async (payload: unknown) => log.push({ method: "editReply", payload }),
    followUp: async (payload: unknown) => log.push({ method: "followUp", payload }),
    showModal: async (payload: unknown) => log.push({ method: "showModal", payload }),
  };
  Object.setPrototypeOf(interaction, ButtonInteraction.prototype);
  return { interaction: interaction as unknown as ButtonInteraction, log };
}

function modalInteraction(sessionId: string, values: Record<string, string>) {
  const log: Array<{ method: string; payload?: unknown }> = [];
  const interaction = {
    customId: wizardId(sessionId, "basic-submit"),
    user: { id: "owner-1" },
    guildId: "guild-1",
    replied: false,
    deferred: false,
    fields: { getTextInputValue: (key: string) => values[key] ?? "" },
    deferUpdate: async () => log.push({ method: "deferUpdate" }),
    editReply: async (payload: unknown) => log.push({ method: "editReply", payload }),
    reply: async (payload: unknown) => log.push({ method: "reply", payload }),
    followUp: async (payload: unknown) => log.push({ method: "followUp", payload }),
  };
  Object.setPrototypeOf(interaction, ModalSubmitInteraction.prototype);
  return { interaction: interaction as unknown as ModalSubmitInteraction, log };
}

describe("handleEmbedInteraction", () => {
  it("applies basic modal values and updates the original V2 panel via editReply", async () => {
    const registry = new EmbedWizardRegistry();
    const session = registry.create("owner-1", "guild-1", "status", createBlankEmbedDraft(), false);
    const { interaction, log } = modalInteraction(session.id, {
      title: "Status",
      description: "Live status",
      color: "#5865F2",
    });

    await handleEmbedInteraction(interaction, { invalidateSticky() {}, deps: deps(registry) });

    expect(session.draft.embedTitle).toBe("Status");
    expect(session.draft.embedDescription).toBe("Live status");
    expect(session.draft.embedColor).toBe(0x5865f2);
    expect(log.map((entry) => entry.method)).toEqual(["deferUpdate", "editReply"]);
    expect((log[1].payload as { content?: string }).content).toBeUndefined();
  });

  it("save without a target channel returns an ephemeral error without updating the panel", async () => {
    const registry = new EmbedWizardRegistry();
    const session = registry.create("owner-1", "guild-1", "status", createBlankEmbedDraft(), false);
    const { interaction, log } = buttonInteraction(session.id, "save");

    await handleEmbedInteraction(interaction, { invalidateSticky() {}, deps: deps(registry) });

    expect(log).toHaveLength(1);
    expect(log[0].method).toBe("reply");
    expect(log[0].payload).toEqual({
      content: "Set a target channel before saving.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("save with a target channel persists the config and replaces the panel with V2 status", async () => {
    const registry = new EmbedWizardRegistry();
    const saved: EmbedConfig[] = [];
    const draft = createBlankEmbedDraft();
    draft.channelId = "channel-1";
    const session = registry.create("owner-1", "guild-1", "status", draft, false);
    const { interaction, log } = buttonInteraction(session.id, "save");

    await handleEmbedInteraction(interaction, {
      invalidateSticky() {},
      deps: deps(registry, saved),
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]._id).toBe("guild-1:status");
    expect(log).toHaveLength(1);
    expect(log[0].method).toBe("update");
    expect((log[0].payload as { content?: string; flags: number }).content).toBeUndefined();
    expect((log[0].payload as { flags: number }).flags).toBe(MessageFlags.IsComponentsV2);
  });

  it("rejects interactions from another user", async () => {
    const registry = new EmbedWizardRegistry();
    const session = registry.create("owner-1", "guild-1", "status", createBlankEmbedDraft(), false);
    const { interaction, log } = buttonInteraction(session.id, "save", "other-user");

    await handleEmbedInteraction(interaction, { invalidateSticky() {}, deps: deps(registry) });

    expect(log[0].method).toBe("reply");
    expect((log[0].payload as { content: string }).content).toBe(
      "This wizard belongs to another user.",
    );
  });

  it("returns an ephemeral error for expired or missing sessions", async () => {
    const registry = new EmbedWizardRegistry();
    const { interaction, log } = buttonInteraction("missing", "save");

    await handleEmbedInteraction(interaction, { invalidateSticky() {}, deps: deps(registry) });

    expect(log[0].method).toBe("reply");
    expect((log[0].payload as { content: string }).content).toBe(
      "Wizard session expired. Run `/embed` again.",
    );
  });
});

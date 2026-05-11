import { describe, expect, it } from "bun:test";
import { MessageFlags } from "discord.js";
import { ErrResult, OkResult } from "@/core/result";
import { compileFeatureClass } from "@/framework/decorators";
import { AiGenerationError } from "@/features/ai/service";
import AiFeature from "../index";
import {
  buildContextEmbed,
  contextSummarySchema,
  executeWithDeps,
  type ContextSummary,
} from "./context";

const summary: ContextSummary = {
  headline: "Deploy planning",
  overview: "The channel is aligning on a deployment plan and risk handling.",
  keyPoints: ["Release scope is mostly settled.", "Rollback needs one more check."],
  decisions: ["Ship behind the existing feature flag."],
  openQuestions: ["Who owns the final smoke test?"],
  participants: [{ name: "Vey", note: "Summarized the release risks." }],
  confidence: "high",
};

function interaction(options: {
  period?: string | null;
  guildId?: string | null;
  userId?: string;
  channelId?: string;
  channel?: unknown;
} = {}) {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const state = {
    calls,
    commandName: "context",
    guildId: options.guildId ?? "guild-1",
    channelId: options.channelId ?? "channel-1",
    channel: options.channel ?? { messages: { fetch: async () => [] } },
    user: { id: options.userId ?? "user-1" },
    deferred: false,
    replied: false,
    options: {
      getString(name: string) {
        return name === "period" ? (options.period ?? null) : null;
      },
    },
    async deferReply(payload: unknown) {
      calls.push({ method: "deferReply", payload });
      state.deferred = true;
    },
    async editReply(payload: unknown) {
      calls.push({ method: "editReply", payload });
      state.replied = true;
    },
    async followUp(payload: unknown) {
      calls.push({ method: "followUp", payload });
    },
  };
  return state;
}

describe("/context", () => {
  it("registers context as an AI slash command", () => {
    const feature = compileFeatureClass(AiFeature);

    expect(feature.commands.map((command) => command.data.name)).toEqual(["ai", "context"]);
  });

  it("exposes the expected context summary schema limits", () => {
    const parsed = contextSummarySchema.parse({
      ...summary,
      keyPoints: Array.from({ length: 9 }, (_, index) => `point ${index}`),
      decisions: Array.from({ length: 9 }, (_, index) => `decision ${index}`),
      openQuestions: Array.from({ length: 9 }, (_, index) => `question ${index}`),
      participants: Array.from({ length: 9 }, (_, index) => ({ name: `p${index}`, note: "note" })),
    });

    expect(parsed.keyPoints).toHaveLength(6);
    expect(parsed.decisions).toHaveLength(5);
    expect(parsed.openQuestions).toHaveLength(5);
    expect(parsed.participants).toHaveLength(6);
  });

  it("renders an embed payload inside Discord limits with mentions disabled", () => {
    const payload = buildContextEmbed({
      summary: {
        ...summary,
        overview: `${"overview ".repeat(900)} <@123>`,
        keyPoints: Array.from({ length: 6 }, () => "point ".repeat(400)),
      },
      periodLabel: "30 minutes",
      messageCount: 42,
      totalFetched: 90,
      partial: true,
      providerLabel: "openai/gpt",
    });
    const raw = JSON.stringify(payload.embeds);

    expect(payload.allowedMentions).toEqual({ parse: [] });
    expect(payload.embeds).toHaveLength(1);
    expect(raw.length).toBeLessThan(6000);
    expect(raw).toContain("Resumen parcial");
  });

  it("does not call AI when the selected window has no messages", async () => {
    const fake = interaction({ userId: "user-success", channelId: "channel-success" });
    let aiCalled = false;
    let rateLimitCalled = false;

    await executeWithDeps(fake as never, {
      collect: async () => OkResult({
        period: { label: "30 minutes", value: "30m", minutes: 30 },
        messages: [],
        transcript: "",
        totalFetched: 0,
        truncatedByMessages: false,
        truncatedByChars: false,
      }),
      summarize: async () => {
        aiCalled = true;
        return OkResult({ object: summary, providerId: "openai", model: "gpt" });
      },
      checkRateLimit: async () => {
        rateLimitCalled = true;
        return { allowed: true, remaining: 1, resetAt: Date.now() + 60_000 };
      },
    });

    expect(aiCalled).toBe(false);
    expect(rateLimitCalled).toBe(false);
    expect(fake.calls[0]).toEqual({ method: "deferReply", payload: { flags: MessageFlags.Ephemeral } });
    expect(JSON.stringify(fake.calls)).toContain("No hay mensajes");
  });

  it("handles AI failure ephemerally without throwing", async () => {
    const fake = interaction();

    await executeWithDeps(fake as never, {
      collect: async () => OkResult({
        period: { label: "30 minutes", value: "30m", minutes: 30 },
        messages: [{ id: "1", authorName: "Vey", authorIsBot: false, createdTimestamp: 1, text: "hello" }],
        transcript: "[12:00] Vey: hello",
        totalFetched: 1,
        truncatedByMessages: false,
        truncatedByChars: false,
      }),
      summarize: async () => ErrResult(new AiGenerationError("all_providers_failed", "model down")),
      checkRateLimit: async () => ({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 }),
    });

    expect(fake.calls.map((call) => call.method)).toEqual(["deferReply", "editReply"]);
    expect(JSON.stringify(fake.calls)).toContain("No pude generar el contexto ahora");
  });

  it("publishes successful summaries publicly and keeps command status ephemeral", async () => {
    const fake = interaction({ userId: "user-success", channelId: "channel-success" });

    await executeWithDeps(fake as never, {
      collect: async () => OkResult({
        period: { label: "30 minutes", value: "30m", minutes: 30 },
        messages: [{ id: "1", authorName: "Vey", authorIsBot: false, createdTimestamp: 1, text: "hello" }],
        transcript: "[12:00] Vey: hello",
        totalFetched: 1,
        truncatedByMessages: false,
        truncatedByChars: false,
      }),
      summarize: async () => OkResult({ object: summary, providerId: "openai", model: "gpt" }),
      checkRateLimit: async () => ({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 }),
    });

    expect(fake.calls.map((call) => call.method)).toEqual(["deferReply", "followUp", "editReply"]);
    expect(JSON.stringify(fake.calls.find((call) => call.method === "followUp")?.payload)).toContain("Deploy planning");
    expect(JSON.stringify(fake.calls.find((call) => call.method === "followUp")?.payload)).toContain('"parse":[]');
  });
});

import { describe, expect, it } from "bun:test";
import {
  type ContextFetchableMessage,
  collectChannelContext,
  normalizeContextPeriod,
} from "./contextService";

function message(
  id: string,
  minutesAgo: number,
  content: string,
  options: { author?: string; bot?: boolean; attachments?: string[] } = {},
): ContextFetchableMessage {
  const now = Date.UTC(2026, 4, 10, 12, 0, 0);
  return {
    id,
    createdTimestamp: now - minutesAgo * 60_000,
    content,
    author: {
      id: `author-${id}`,
      username: options.author ?? `user-${id}`,
      bot: options.bot ?? false,
    },
    attachments: new Map(
      (options.attachments ?? []).map((name, index) => [`${id}-${index}`, { name }]),
    ),
    embeds: [],
  };
}

function channelWithPages(pages: ContextFetchableMessage[][]) {
  const calls: Array<{ limit?: number; before?: string }> = [];
  return {
    calls,
    channel: {
      messages: {
        async fetch(options: { limit?: number; before?: string }) {
          calls.push(options);
          return pages[calls.length - 1] ?? [];
        },
      },
    },
  };
}

describe("AI context collection", () => {
  it("normalizes supported context periods", () => {
    expect(normalizeContextPeriod(null)).toEqual({
      label: "30 minutes",
      value: "30m",
      minutes: 30,
    });
    expect(normalizeContextPeriod("15m")).toEqual({
      label: "15 minutes",
      value: "15m",
      minutes: 15,
    });
    expect(normalizeContextPeriod("120m")).toEqual({
      label: "2 hours",
      value: "120m",
      minutes: 120,
    });
    expect(normalizeContextPeriod("nope")).toEqual({
      label: "30 minutes",
      value: "30m",
      minutes: 30,
    });
  });

  it("paginates messages until the requested time window is exhausted", async () => {
    const { channel, calls } = channelWithPages([
      [message("3", 5, "newest"), message("2", 20, "middle")],
      [message("1", 40, "older"), message("0", 80, "too old")],
    ]);

    const result = await collectChannelContext(channel, {
      periodMinutes: 60,
      now: Date.UTC(2026, 4, 10, 12, 0, 0),
    });

    expect(result.isOk()).toBe(true);
    const collected = result.unwrap();
    expect(calls).toEqual([{ limit: 100 }, { limit: 100, before: "2" }]);
    expect(collected.messages.map((entry) => entry.id)).toEqual(["1", "2", "3"]);
    expect(collected.totalFetched).toBe(4);
  });

  it("includes bot messages and attachment metadata", async () => {
    const { channel } = channelWithPages([
      [message("2", 2, "", { bot: true, author: "tx-bot", attachments: ["audit.txt"] })],
    ]);

    const result = await collectChannelContext(channel, {
      periodMinutes: 15,
      now: Date.UTC(2026, 4, 10, 12, 0, 0),
    });

    expect(result.isOk()).toBe(true);
    const collected = result.unwrap();
    expect(collected.messages[0]?.authorName).toBe("tx-bot");
    expect(collected.messages[0]?.authorIsBot).toBe(true);
    expect(collected.transcript).toContain("[attachments: audit.txt]");
  });

  it("reads Discord Collection-like fetch results by message value", async () => {
    const discordCollection = new Map<string, ContextFetchableMessage>([
      ["2", message("2", 2, "collection newest")],
      ["1", message("1", 4, "collection oldest")],
    ]);
    let calls = 0;

    const result = await collectChannelContext(
      {
        messages: {
          async fetch() {
            calls += 1;
            return calls === 1 ? discordCollection : [];
          },
        },
      },
      {
        periodMinutes: 15,
        now: Date.UTC(2026, 4, 10, 12, 0, 0),
      },
    );

    expect(result.isOk()).toBe(true);
    const collected = result.unwrap();
    expect(collected.messages.map((entry) => entry.id)).toEqual(["1", "2"]);
  });

  it("caps transcript size while preserving the most recent normalized messages", async () => {
    const { channel } = channelWithPages([
      [
        message("4", 1, "recent final"),
        message("3", 2, "recent middle"),
        message("2", 3, "x".repeat(200)),
        message("1", 4, "older start"),
      ],
    ]);

    const result = await collectChannelContext(channel, {
      periodMinutes: 15,
      now: Date.UTC(2026, 4, 10, 12, 0, 0),
      maxTranscriptChars: 90,
      maxMessageChars: 80,
    });

    expect(result.isOk()).toBe(true);
    const collected = result.unwrap();
    expect(collected.truncatedByChars).toBe(true);
    expect(collected.messages.map((entry) => entry.id)).toEqual(["3", "4"]);
    expect(collected.transcript).toContain("recent middle");
    expect(collected.transcript).toContain("recent final");
    expect(collected.transcript).not.toContain("older start");
  });

  it("returns an error result instead of throwing when Discord fetch fails", async () => {
    const result = await collectChannelContext(
      {
        messages: {
          async fetch() {
            throw new Error("missing history");
          },
        },
      },
      {
        periodMinutes: 30,
        now: Date.UTC(2026, 4, 10, 12, 0, 0),
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("FETCH_FAILED");
  });
});

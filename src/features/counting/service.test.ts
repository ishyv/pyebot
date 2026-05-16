import { describe, expect, it } from "bun:test";
import { OkResult, type Result } from "@/core/result";
import {
  type CountingStateRecord,
  type CountingStateRepository,
  createDefaultCountingState,
} from "@/db/repositories/counting";
import { type CountingMessageInput, processCountingMessage } from "./service";

class MemoryCountingRepository implements CountingStateRepository {
  private state: CountingStateRecord | null = null;

  async getState(
    _guildId: string,
    _channelId: string,
  ): Promise<Result<CountingStateRecord | null>> {
    await Promise.resolve();
    return OkResult(this.state);
  }

  async setState(state: CountingStateRecord): Promise<Result<CountingStateRecord>> {
    await Promise.resolve();
    this.state = state;
    return OkResult(state);
  }

  current(): CountingStateRecord | null {
    return this.state;
  }
}

function message(
  input: Partial<CountingMessageInput> & { reactions: string[] },
): CountingMessageInput {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    authorId: "user-1",
    authorIsBot: false,
    content: "0",
    async react(emoji: string) {
      input.reactions.push(emoji);
    },
    ...input,
  };
}

describe("processCountingMessage", () => {
  it("ignores bots, DMs, and non-configured channels", async () => {
    const repo = new MemoryCountingRepository();
    const reactions: string[] = [];

    await expect(
      processCountingMessage(message({ authorIsBot: true, reactions }), {
        configuredChannelId: "channel-1",
        stateRepository: repo,
      }),
    ).resolves.toBe("ignored");
    await expect(
      processCountingMessage(message({ guildId: null, reactions }), {
        configuredChannelId: "channel-1",
        stateRepository: repo,
      }),
    ).resolves.toBe("ignored");
    await expect(
      processCountingMessage(message({ channelId: "other", reactions }), {
        configuredChannelId: "channel-1",
        stateRepository: repo,
      }),
    ).resolves.toBe("ignored");

    expect(reactions).toEqual([]);
    expect(repo.current()).toBeNull();
  });

  it("accepts a valid sequence from different users", async () => {
    const repo = new MemoryCountingRepository();
    const reactions: string[] = [];

    await processCountingMessage(message({ authorId: "user-1", content: "1-1", reactions }), {
      configuredChannelId: "channel-1",
      stateRepository: repo,
    });
    await processCountingMessage(message({ authorId: "user-2", content: "2/2", reactions }), {
      configuredChannelId: "channel-1",
      stateRepository: repo,
    });

    expect(reactions).toEqual(["✅", "✅"]);
    expect(repo.current()?.expectedValue).toBe(2);
    expect(repo.current()?.lastUserId).toBe("user-2");
  });

  it("resets on same-user repeat and wrong expressions", async () => {
    const repo = new MemoryCountingRepository();
    const reactions: string[] = [];

    await repo.setState({
      ...createDefaultCountingState("guild-1", "channel-1"),
      expectedValue: 1,
      lastUserId: "user-1",
    });
    await expect(
      processCountingMessage(message({ authorId: "user-1", content: "1", reactions }), {
        configuredChannelId: "channel-1",
        stateRepository: repo,
      }),
    ).resolves.toBe("reset");
    expect(repo.current()?.expectedValue).toBe(0);

    await expect(
      processCountingMessage(message({ authorId: "user-2", content: "99", reactions }), {
        configuredChannelId: "channel-1",
        stateRepository: repo,
      }),
    ).resolves.toBe("reset");
    expect(reactions).toEqual(["❌", "❌"]);
  });

  it("serializes concurrent messages for the same guild and channel", async () => {
    const repo = new MemoryCountingRepository();
    const reactions: string[] = [];

    await Promise.all([
      processCountingMessage(message({ authorId: "user-1", content: "0", reactions }), {
        configuredChannelId: "channel-1",
        stateRepository: repo,
      }),
      processCountingMessage(message({ authorId: "user-2", content: "0", reactions }), {
        configuredChannelId: "channel-1",
        stateRepository: repo,
      }),
    ]);

    expect(reactions).toEqual(["✅", "❌"]);
    expect(repo.current()?.expectedValue).toBe(0);
    expect(repo.current()?.lastUserId).toBeNull();
  });
});

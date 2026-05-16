import { beforeEach, describe, expect, test } from "bun:test";
import type { Message } from "discord.js";
import { getImportantMessage, markImportant, unmarkImportant } from "./importantMessages";

function fakeMessage(id: string): Message {
  return { id, channelId: "ch1", guildId: "g1" } as unknown as Message;
}

const noopRestore = async () => ({
  payload: { components: [], flags: 0 } as any,
  onRestored: async () => {},
});

beforeEach(() => {
  // Clear registry between tests
  unmarkImportant("msg1");
  unmarkImportant("msg2");
});

describe("importantMessages registry", () => {
  test("markImportant stores entry by message id", () => {
    const msg = fakeMessage("msg1");
    markImportant(msg, "test reason", noopRestore);
    const entry = getImportantMessage("msg1");
    expect(entry).toBeDefined();
    expect(entry?.reason).toBe("test reason");
    expect(entry?.channelId).toBe("ch1");
    expect(entry?.guildId).toBe("g1");
  });

  test("unmarkImportant removes entry", () => {
    const msg = fakeMessage("msg2");
    markImportant(msg, "reason", noopRestore);
    expect(getImportantMessage("msg2")).toBeDefined();
    unmarkImportant("msg2");
    expect(getImportantMessage("msg2")).toBeUndefined();
  });

  test("getImportantMessage returns undefined for unknown id", () => {
    expect(getImportantMessage("unknown")).toBeUndefined();
  });

  test("markImportant overwrites existing entry for same id", () => {
    const msg = fakeMessage("msg1");
    markImportant(msg, "first", noopRestore);
    markImportant(msg, "second", noopRestore);
    expect(getImportantMessage("msg1")?.reason).toBe("second");
  });
});

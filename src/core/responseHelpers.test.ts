import { describe, expect, it } from "bun:test";
import { MessageFlags } from "discord.js";
import { ErrResult, OkResult } from "@/core/result";
import { handleDbError } from "./responseHelpers";

function fakeContext() {
  const calls: Array<{ method: string; payload?: unknown; args?: unknown[] }> = [];
  return {
    calls,
    ctx: {
      logger: {
        error(...args: unknown[]) {
          calls.push({ method: "log.error", args });
        },
      },
      respond: {
        async fail(payload: unknown) {
          calls.push({ method: "fail", payload });
        },
      },
    },
  };
}

describe("handleDbError", () => {
  it("returns false and does not reply for successful results", async () => {
    const { ctx, calls } = fakeContext();

    const handled = await handleDbError(OkResult(undefined), ctx, "Could not update config.");

    expect(handled).toBe(false);
    expect(calls).toEqual([]);
  });

  it("logs and replies with a standard failure message for failed results", async () => {
    const { ctx, calls } = fakeContext();

    const handled = await handleDbError(
      ErrResult(new Error("db down")),
      ctx,
      "Could not update config.",
      "automod update failed",
    );

    expect(handled).toBe(true);
    expect(calls[0]).toMatchObject({
      method: "log.error",
      args: ["automod update failed", expect.any(Error)],
    });
    expect(calls[1]?.method).toBe("fail");
    expect(calls[1]?.payload).toMatchObject({ flags: MessageFlags.IsComponentsV2 });
    expect(JSON.stringify(calls[1]?.payload)).toContain("## Failed\\nCould not update config.");
  });
});

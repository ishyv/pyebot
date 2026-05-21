import { describe, expect, it } from "bun:test";
import { MessageFlags } from "discord.js";
import { container, text } from "@/ui/v2";
import {
  modalUpdatePanel,
  replacePanelWithStatus,
  replyEphemeralPanel,
  replyEphemeralText,
  updatePanel,
} from "./responses";

function calls() {
  const log: Array<{ method: string; payload?: unknown }> = [];
  return {
    log,
    interaction: {
      replied: false,
      deferred: false,
      reply: async (payload: unknown) => log.push({ method: "reply", payload }),
      update: async (payload: unknown) => log.push({ method: "update", payload }),
      editReply: async (payload: unknown) => log.push({ method: "editReply", payload }),
      followUp: async (payload: unknown) => log.push({ method: "followUp", payload }),
      deferUpdate: async () => log.push({ method: "deferUpdate" }),
    },
  };
}

describe("embed interaction responses", () => {
  it("replyEphemeralText replies with content and ephemeral flags", async () => {
    const { interaction, log } = calls();
    await replyEphemeralText(interaction as never, "Nope.");
    expect(log[0]).toEqual({
      method: "reply",
      payload: { content: "Nope.", flags: MessageFlags.Ephemeral },
    });
  });

  it("replyEphemeralPanel sends a V2 ephemeral panel without content", async () => {
    const { interaction, log } = calls();
    await replyEphemeralPanel(interaction as never, container("info", text("Panel")));
    const payload = log[0].payload as { content?: string; flags: number };
    expect(log[0].method).toBe("reply");
    expect(payload.content).toBeUndefined();
    expect(payload.flags & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
    expect(payload.flags & MessageFlags.Ephemeral).toBe(MessageFlags.Ephemeral);
  });

  it("updatePanel updates V2 components without legacy content", async () => {
    const { interaction, log } = calls();
    await updatePanel(interaction as never, container("info", text("Panel")));
    const payload = log[0].payload as { content?: string; flags: number };
    expect(log[0].method).toBe("update");
    expect(payload.content).toBeUndefined();
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
  });

  it("modalUpdatePanel acknowledges modal submit then edits through the webhook", async () => {
    const { interaction, log } = calls();
    await modalUpdatePanel(interaction as never, container("info", text("Panel")));
    expect(log.map((entry) => entry.method)).toEqual(["deferUpdate", "editReply"]);
    expect((log[1].payload as { content?: string }).content).toBeUndefined();
  });

  it("replacePanelWithStatus keeps terminal panel updates V2-only", async () => {
    const { interaction, log } = calls();
    await replacePanelWithStatus(interaction as never, "Saved.");
    const payload = log[0].payload as { content?: string; flags: number };
    expect(log[0].method).toBe("update");
    expect(payload.content).toBeUndefined();
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
  });
});

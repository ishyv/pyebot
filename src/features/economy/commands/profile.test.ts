import { describe, expect, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";
import { EconomyAccount } from "@/components/economy-account";
import { UserCurrency } from "@/components/user-currency";
import type { Ctx } from "@/framework/types";
import command from "./profile";

describe("/eco-profile", () => {
  test("creates the target economy account on demand", async () => {
    const calls: string[] = [];
    let editedReply: unknown;

    const ctx = {
      async ensure(id: string, component: unknown) {
        expect(id).toBe("user-1");
        expect(component).toBe(EconomyAccount);
        calls.push("ensure:account");
        return {
          status: "ok",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          lastActivityAt: new Date("2026-01-01T00:00:00.000Z"),
          version: 0,
          dailyStreak: 0,
          lastDailyAt: null,
        };
      },
      async get(id: string, component: unknown) {
        expect(id).toBe("user-1");
        expect(component).toBe(UserCurrency);
        calls.push("get:wallet");
        return null;
      },
    } as unknown as Ctx;

    const interaction = {
      guild: { id: "guild-1" },
      user: {
        id: "user-1",
        username: "hyvnt",
        displayAvatarURL: () => "https://example.test/avatar.png",
      },
      options: {
        getUser: () => null,
      },
      async deferReply() {
        calls.push("defer");
      },
      async editReply(payload: unknown) {
        editedReply = payload;
      },
    } as unknown as ChatInputCommandInteraction;

    await command.execute(interaction, ctx);

    expect(calls).toContain("ensure:account");
    expect(calls).toContain("get:wallet");
    expect(JSON.stringify(editedReply)).toContain("Economy Profile");
    expect(JSON.stringify(editedReply)).not.toContain("doesn't have an economy account yet");
  });
});

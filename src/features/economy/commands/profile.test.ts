import { describe, expect, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";
import { EconomyAccount, UserCurrency } from "@/components/economy/wallet";
import { User } from "@/components/entities";
import type { EntityComponent, EntityKind } from "@/framework";
import type { Ctx } from "@/framework/types";
import command from "./profile";

describe("/eco-profile", () => {
  test("creates the target economy account on demand", async () => {
    const calls: string[] = [];
    let editedReply: unknown;

    const ctx = {
      of(kind: EntityKind, id: string) {
        expect(kind).toBe(User);
        expect(id).toBe("user-1");
        return {
          async get<T>(component: EntityComponent<T>) {
            expect(component as unknown).toBe(EconomyAccount);
            calls.push("get:account");
            return {
              status: "ok",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              lastActivityAt: new Date("2026-01-01T00:00:00.000Z"),
              version: 0,
              dailyStreak: 0,
              lastDailyAt: null,
            } as T;
          },
          async peek<T>(component: EntityComponent<T>) {
            expect(component as unknown).toBe(UserCurrency);
            calls.push("peek:wallet");
            return null;
          },
        };
      },
      respond: {
        async defer() {
          calls.push("defer");
        },
        async send(payload: unknown) {
          editedReply = payload;
        },
      },
    } as unknown as Ctx;

    const interaction = {
      guildId: "guild-1",
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

    expect(calls).toContain("get:account");
    expect(calls).toContain("peek:wallet");
    expect(JSON.stringify(editedReply)).toContain("Economy Profile");
    expect(JSON.stringify(editedReply)).not.toContain("doesn't have an economy account yet");
  });
});

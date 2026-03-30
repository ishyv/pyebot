/**
 * Tests for handleOnboard button handler.
 * Verifies that the correct starter tool is set in loadout.weapon
 * for each profession (miner → starter_pickaxe, lumber → starter_axe).
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult, ErrResult } from "@/core/result";
import type { RpgProfileData } from "@/db/schemas/rpg-profile";

// ---------------------------------------------------------------------------
// Mock @/db/repositories/rpg BEFORE importing the handler
// ---------------------------------------------------------------------------

const profileStore = new Map<string, RpgProfileData>();

function makeProfile(overrides: Partial<RpgProfileData> = {}): RpgProfileData {
  return {
    loadout: {
      weapon: null,
      shield: null,
      helmet: null,
      chest: null,
      pants: null,
      boots: null,
      ring: null,
      necklace: null,
    },
    hpCurrent: 100,
    wins: 0,
    losses: 0,
    isFighting: false,
    activeFightId: null,
    starterKitType: null,
    starterKitClaimedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    version: 0,
    ...overrides,
  };
}

const mockPatchRpgProfile = mock(
  async (userId: string, patch: Partial<RpgProfileData>) => {
    const existing = profileStore.get(userId) ?? makeProfile();
    const updated = { ...existing, ...patch };
    profileStore.set(userId, updated);
    return OkResult(updated);
  },
);

mock.module("@/db/repositories/rpg", () => ({
  patchRpgProfile: mockPatchRpgProfile,
  getRpgProfile: mock(async (userId: string) =>
    OkResult(profileStore.get(userId) ?? null),
  ),
  ensureRpgProfile: mock(async (userId: string) => {
    if (!profileStore.has(userId)) profileStore.set(userId, makeProfile());
    return OkResult(profileStore.get(userId)!);
  }),
  rpgStore: {},
}));

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const { handleOnboard } = await import("./onboard");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInteraction(profession: "miner" | "lumber", userId = "user1") {
  return {
    customId: `rpg:onboard:${profession}`,
    user: { id: userId },
    deferReply: mock(async () => {}),
    editReply: mock(async () => {}),
    reply: mock(async () => {}),
  } as unknown as import("discord.js").ButtonInteraction;
}

function resetAll() {
  profileStore.clear();
  mockPatchRpgProfile.mockReset();
  mockPatchRpgProfile.mockImplementation(
    async (userId: string, patch: Partial<RpgProfileData>) => {
      const existing = profileStore.get(userId) ?? makeProfile();
      const updated = { ...existing, ...patch };
      profileStore.set(userId, updated);
      return OkResult(updated);
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleOnboard", () => {
  beforeEach(resetAll);

  test("miner: stores starter_pickaxe in loadout.weapon", async () => {
    const interaction = makeInteraction("miner", "user_miner");
    await handleOnboard(interaction);

    const profile = profileStore.get("user_miner");
    expect(profile).toBeDefined();
    const weapon = profile!.loadout.weapon;
    expect(weapon).not.toBeNull();
    expect(typeof weapon).toBe("object");
    expect((weapon as { itemId: string }).itemId).toBe("starter_pickaxe");
  });

  test("lumber: stores starter_axe in loadout.weapon", async () => {
    const interaction = makeInteraction("lumber", "user_lumber");
    await handleOnboard(interaction);

    const profile = profileStore.get("user_lumber");
    expect(profile).toBeDefined();
    const weapon = profile!.loadout.weapon;
    expect(weapon).not.toBeNull();
    expect(typeof weapon).toBe("object");
    expect((weapon as { itemId: string }).itemId).toBe("starter_axe");
  });

  test("miner: starter_pickaxe has instanceId 'starter' and durability 50", async () => {
    const interaction = makeInteraction("miner", "user_miner2");
    await handleOnboard(interaction);

    const profile = profileStore.get("user_miner2");
    const weapon = profile!.loadout.weapon as {
      instanceId: string;
      itemId: string;
      durability: number;
    };
    expect(weapon.instanceId).toBe("starter");
    expect(weapon.durability).toBe(50);
  });

  test("lumber: starter_axe has instanceId 'starter' and durability 50", async () => {
    const interaction = makeInteraction("lumber", "user_lumber2");
    await handleOnboard(interaction);

    const profile = profileStore.get("user_lumber2");
    const weapon = profile!.loadout.weapon as {
      instanceId: string;
      itemId: string;
      durability: number;
    };
    expect(weapon.instanceId).toBe("starter");
    expect(weapon.durability).toBe(50);
  });

  test("unknown profession: replies with error and does not patch", async () => {
    const interaction = {
      customId: "rpg:onboard:wizard",
      user: { id: "user_wizard" },
      deferReply: mock(async () => {}),
      editReply: mock(async () => {}),
      reply: mock(async () => {}),
    } as unknown as import("discord.js").ButtonInteraction;

    await handleOnboard(interaction);

    expect(interaction.reply).toHaveBeenCalled();
    expect(profileStore.has("user_wizard")).toBe(false);
  });

  test("patchRpgProfile failure: replies with failure message", async () => {
    mockPatchRpgProfile.mockImplementation(async () =>
      ErrResult(new Error("DB down")),
    );

    const interaction = makeInteraction("miner", "user_fail");
    await handleOnboard(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Failed") }),
    );
  });
});

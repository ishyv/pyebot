/**
 * Tests for handleOnboard button handler.
 * Verifies that the correct starter tool is set in loadout.weapon
 * for each profession (miner → starter_pickaxe, lumber → starter_axe).
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { EquippedItemValue, RpgProfileValue } from "@/components/rpg-profile";
import type { Ctx } from "@/framework/types";

// ---------------------------------------------------------------------------
// Mock component-backed profile helpers BEFORE importing the handler
// ---------------------------------------------------------------------------

const profileStore = new Map<string, RpgProfileValue>();

function makeProfile(overrides: Partial<RpgProfileValue> = {}): RpgProfileValue {
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
    stashSize: 20,
    activeExpeditionId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    version: 0,
    ...overrides,
  };
}

const mockPatchRpgProfile = mock(
  async (_ctx: Ctx, userId: string, patch: Partial<RpgProfileValue>) => {
    const existing = profileStore.get(userId) ?? makeProfile();
    const updated = { ...existing, ...patch };
    profileStore.set(userId, updated);
    return updated;
  },
);

mock.module("@/features/rpg/profile", () => ({
  patchRpgProfile: mockPatchRpgProfile,
  getRpgProfile: mock(async (_ctx: Ctx, userId: string) => profileStore.get(userId) ?? null),
  ensureRpgProfile: mock(async (_ctx: Ctx, userId: string) => {
    if (!profileStore.has(userId)) profileStore.set(userId, makeProfile());
    const profile = profileStore.get(userId);
    if (!profile) throw new Error("Failed to create profile fixture");
    return profile;
  }),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const { handleOnboard } = await import("./onboard");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInteraction(userId = "user1") {
  return {
    user: { id: userId },
    deferReply: mock(async () => {}),
    editReply: mock(async () => {}),
    reply: mock(async () => {}),
  } as unknown as import("discord.js").ButtonInteraction;
}

/** Runs the handler with a decoded profession arg, as routeHandlers would. */
function onboard(
  interaction: import("discord.js").ButtonInteraction,
  profession: "miner" | "lumber",
) {
  return handleOnboard(interaction, { profession }, makeCtx());
}

function makeCtx(): Ctx {
  return {} as Ctx;
}

function expectStoredProfile(userId: string): RpgProfileValue {
  const profile = profileStore.get(userId);
  expect(profile).toBeDefined();
  if (!profile) throw new Error(`Expected profile fixture for ${userId}`);
  return profile;
}

function resetAll() {
  profileStore.clear();
  mockPatchRpgProfile.mockReset();
  mockPatchRpgProfile.mockImplementation(
    async (_ctx: Ctx, userId: string, patch: Partial<RpgProfileValue>) => {
      const existing = profileStore.get(userId) ?? makeProfile();
      const updated = { ...existing, ...patch };
      profileStore.set(userId, updated);
      return updated;
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleOnboard", () => {
  beforeEach(resetAll);

  test("miner: stores starter_pickaxe in loadout.weapon", async () => {
    const interaction = makeInteraction("user_miner");
    await onboard(interaction, "miner");

    const profile = expectStoredProfile("user_miner");
    const weapon = profile.loadout.weapon;
    expect(weapon).not.toBeNull();
    expect(typeof weapon).toBe("object");
    expect((weapon as EquippedItemValue).itemId).toBe("starter_pickaxe");

    // starterKitType and starterKitClaimedAt must also be set
    expect(profile.starterKitType).toBe("miner");
    expect(profile.starterKitClaimedAt).toBeInstanceOf(Date);
  });

  test("lumber: stores starter_axe in loadout.weapon", async () => {
    const interaction = makeInteraction("user_lumber");
    await onboard(interaction, "lumber");

    const profile = expectStoredProfile("user_lumber");
    const weapon = profile.loadout.weapon;
    expect(weapon).not.toBeNull();
    expect(typeof weapon).toBe("object");
    expect((weapon as EquippedItemValue).itemId).toBe("starter_axe");

    // starterKitType and starterKitClaimedAt must also be set
    expect(profile.starterKitType).toBe("lumber");
    expect(profile.starterKitClaimedAt).toBeInstanceOf(Date);
  });

  test("miner: starter_pickaxe has instanceId 'starter' and durability 50", async () => {
    const interaction = makeInteraction("user_miner2");
    await onboard(interaction, "miner");

    const profile = expectStoredProfile("user_miner2");
    const weapon = profile.loadout.weapon as EquippedItemValue;
    expect(weapon.instanceId).toBe("starter");
    expect(weapon.durability).toBe(50);
  });

  test("lumber: starter_axe has instanceId 'starter' and durability 50", async () => {
    const interaction = makeInteraction("user_lumber2");
    await onboard(interaction, "lumber");

    const profile = expectStoredProfile("user_lumber2");
    const weapon = profile.loadout.weapon as EquippedItemValue;
    expect(weapon.instanceId).toBe("starter");
    expect(weapon.durability).toBe(50);
  });

  // An unknown profession can no longer reach the handler: the `onboard` route's
  // oneOf(["miner","lumber"]) codec fails to decode it and the dispatch is
  // skipped before the handler runs (see routes.ts + the framework decode tests).

  test("patchRpgProfile failure: replies with failure message", async () => {
    mockPatchRpgProfile.mockImplementation(async () => {
      throw new Error("DB down");
    });

    const interaction = makeInteraction("user_fail");
    await onboard(interaction, "miner");

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Failed") }),
    );
  });

  // The handler has no re-onboarding guard — calling it twice for the same
  // user simply overwrites the profile with the new profession. There is no
  // early return or error path for duplicate calls, so the second call must
  // also succeed and leave the profile in a valid state.
  test("re-onboard (double-click): second call overwrites without crashing", async () => {
    const interaction1 = makeInteraction("user_reoard");
    await onboard(interaction1, "miner");

    const profileAfterFirst = profileStore.get("user_reoard");
    expect(profileAfterFirst?.starterKitType).toBe("miner");

    // Second call — different profession simulating a button re-click
    const interaction2 = makeInteraction("user_reoard");
    await onboard(interaction2, "lumber");

    // No crash; second call should succeed and overwrite
    expect(interaction2.editReply).toHaveBeenCalled();

    const profileAfterSecond = expectStoredProfile("user_reoard");
    expect(profileAfterSecond.starterKitType).toBe("lumber");
    expect(profileAfterSecond.starterKitClaimedAt).toBeInstanceOf(Date);
    expect((profileAfterSecond.loadout.weapon as EquippedItemValue).itemId).toBe("starter_axe");
  });
});

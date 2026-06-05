import { describe, expect, test } from "bun:test";
import { User } from "@/components/entities";
import { RpgProfile, type RpgProfileValue } from "@/components/rpg/profile";
import type { EntityComponent, EntityKind } from "@/framework";
import type { Ctx } from "@/framework/types";
import { ensureRpgProfile, getRpgProfile, patchRpgProfile } from "./profile";

function makeCtx(initial: RpgProfileValue | null = null): {
  ctx: Ctx;
  read: () => RpgProfileValue | null;
} {
  let stored = initial;

  const ctx = {
    async get() {
      throw new Error("legacy get should not be used for RPG profiles");
    },
    async ensure() {
      throw new Error("legacy ensure should not be used for RPG profiles");
    },
    async patch() {
      throw new Error("legacy patch should not be used for RPG profiles");
    },
    of(kind: EntityKind, id: string) {
      expect(kind).toBe(User);
      expect(id).toBe("user-1");

      return {
        async peek<T>(component: EntityComponent<T>) {
          expect(component.name).toBe("rpgProfile");
          return stored as T | null;
        },
        async get<T>(component: EntityComponent<T>) {
          expect(component.name).toBe("rpgProfile");
          if (!stored) stored = RpgProfile.schema.parse({});
          return stored as T;
        },
        async update<T>(
          component: EntityComponent<T>,
          patch: Partial<T> | ((current: T) => Partial<T>),
        ) {
          expect(component.name).toBe("rpgProfile");
          const current = (stored ?? RpgProfile.schema.parse({})) as T;
          const partial = typeof patch === "function" ? patch(current) : patch;
          stored = { ...(current as RpgProfileValue), ...(partial as Partial<RpgProfileValue>) };
        },
      };
    },
    async set() {},
    async delete() {},
    async query() {
      return [];
    },
    select() {
      throw new Error("select not implemented in RPG profile test ctx");
    },
    transaction() {
      throw new Error("transaction not implemented in RPG profile test ctx");
    },
    async emit() {},
    client: {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    cooldowns: {},
    locks: {},
    sessions: {},
    interaction: null,
  } as unknown as Ctx;

  return { ctx, read: () => stored };
}

describe("RPG profile helpers", () => {
  test("getRpgProfile returns null without creating profile state", async () => {
    const made = makeCtx();

    await expect(getRpgProfile(made.ctx, "user-1")).resolves.toBeNull();
    expect(made.read()).toBeNull();
  });

  test("ensureRpgProfile returns schema defaults from the user entity", async () => {
    const made = makeCtx();

    const profile = await ensureRpgProfile(made.ctx, "user-1");

    expect(profile.hpCurrent).toBe(100);
    expect(profile.stashSize).toBe(20);
    expect(profile.loadout.weapon).toBeNull();
    expect(made.read()).toBe(profile);
  });

  test("patchRpgProfile writes through the user entity and refreshes updatedAt", async () => {
    const made = makeCtx(RpgProfile.schema.parse({ updatedAt: new Date("2026-01-01") }));

    const profile = await patchRpgProfile(made.ctx, "user-1", { hpCurrent: 42 });

    expect(profile.hpCurrent).toBe(42);
    expect(profile.updatedAt.getTime()).toBeGreaterThan(new Date("2026-01-01").getTime());
    expect(made.read()).toBe(profile);
  });
});

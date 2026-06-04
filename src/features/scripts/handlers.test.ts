import { describe, expect, test } from "bun:test";
import { Collection, type Guild } from "discord.js";
import {
  ScriptDefinition,
  type ScriptDefinitionValue,
  scriptId,
} from "@/components/script-definition";
import { sessions } from "@/core/state";
import type { Component, Ctx } from "@/framework/types";
import type { InputField } from "./engine";
import { onBackToInputs, onCollectorRun, onConfirmApply, onModalSubmit } from "./handlers";
import { type ScriptInputSession, sessionKey } from "./input-collector";
import type { Runnable } from "./run";

const createdAt = new Date("2026-06-03T12:00:00.000Z");

function script(): ScriptDefinitionValue {
  return {
    guildId: "guild-1",
    name: "u-role-count",
    description: "old description",
    source: "return 1;",
    capabilities: [],
    trigger: { kind: "manual" },
    reportChannelId: null,
    scheduleNextRunAt: null,
    createdBy: "author-1",
    enabled: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function makeCtx(existing: ScriptDefinitionValue): { ctx: Ctx; writes: unknown[] } {
  const writes: unknown[] = [];
  const ctx = {
    async get<T>(id: string, component: Component<T>) {
      if (
        component.collection === ScriptDefinition.collection &&
        id === scriptId("guild-1", "u-role-count")
      ) {
        return existing as T;
      }
      return null;
    },
    async set<T>(id: string, component: Component<T>, value: T) {
      writes.push({ id, collection: component.collection, value });
    },
    async patch() {
      throw new Error("ctx.patch should not be used for ScriptDefinition updates");
    },
  } as unknown as Ctx;
  return { ctx, writes };
}

function modalSubmit() {
  const replies: unknown[] = [];
  return {
    interaction: {
      customId: "scr:modal:u-role-count",
      guildId: "guild-1",
      user: { id: "editor-1" },
      isModalSubmit: () => true,
      fields: {
        getTextInputValue(id: string) {
          const values: Record<string, string> = {
            source: "return 2;",
            description: "new description",
            capabilities: "roles",
          };
          return values[id] ?? "";
        },
      },
      reply: async (payload: unknown) => {
        replies.push(payload);
      },
    },
    replies,
  };
}

function fakeGuild(recorded: string[] = []): Guild {
  const members = new Collection<string, unknown>();
  members.set("u1", {
    id: "u1",
    user: { tag: "u1#0", bot: false },
    roles: { cache: new Collection() },
    joinedTimestamp: 0,
  });

  const roles = new Collection<string, { id: string; name: string }>();
  roles.set("r-vet", { id: "r-vet", name: "Veteran" });

  return {
    id: "guild-1",
    name: "Guild",
    memberCount: 1,
    members: {
      fetch: async (id?: string) => {
        if (id === undefined) return members;
        recorded.push(`fetch:${id}`);
        return {
          id,
          roles: { add: async (roleId: string) => recorded.push(`add:${id}:${roleId}`) },
        };
      },
    },
    roles: { cache: roles },
    channels: { cache: new Collection() },
  } as unknown as Guild;
}

const inputFields: InputField[] = [
  { type: "role", name: "role", label: "Role", required: true, placeholder: "" },
];

function runnable(
  source: string,
  capabilities: ScriptDefinitionValue["capabilities"] = [],
): Runnable {
  return {
    kind: "stored",
    def: {
      ...script(),
      source,
      capabilities,
    },
  };
}

function seedInputSession(
  source: string,
  capabilities: ScriptDefinitionValue["capabilities"] = [],
): string {
  const key = sessionKey("user-1", "guild-1", "u-role-count");
  sessions.delete(key);
  sessions.set(key, {
    runnable: runnable(source, capabilities),
    fields: inputFields,
    values: { role: "r-vet" },
  } satisfies ScriptInputSession);
  return key;
}

function buttonInteraction(customId: string, recorded: string[] = []) {
  const updates: unknown[] = [];
  const edits: unknown[] = [];
  return {
    interaction: {
      customId,
      guildId: "guild-1",
      user: { id: "user-1", tag: "user#0" },
      channelId: "channel-1",
      guild: fakeGuild(recorded),
      memberPermissions: { has: () => true },
      isModalSubmit: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isChannelSelectMenu: () => false,
      isButton: () => true,
      deferUpdate: async () => {},
      update: async (payload: unknown) => {
        updates.push(payload);
      },
      editReply: async (payload: unknown) => {
        edits.push(payload);
      },
      reply: async (payload: unknown) => {
        updates.push(payload);
      },
    },
    updates,
    edits,
  };
}

function payloadText(payload: unknown): string {
  return JSON.stringify(payload);
}

describe("ScriptHandlers", () => {
  test("editing an existing script saves through ctx.set", async () => {
    const current = script();
    const { ctx, writes } = makeCtx(current);
    const { interaction, replies } = modalSubmit();

    await onModalSubmit(interaction as never, "u-role-count", ctx);

    expect(writes).toHaveLength(1);
    const write = writes[0] as { value: ScriptDefinitionValue };
    expect(write.value).toMatchObject({
      guildId: "guild-1",
      name: "u-role-count",
      description: "new description",
      source: "return 2;",
      capabilities: ["roles"],
      createdBy: "author-1",
      createdAt,
      trigger: { kind: "manual" },
    });
    expect(write.value.updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
    expect(replies).toHaveLength(1);
    expect(JSON.stringify(replies[0])).toContain("Saved");
  });

  test("successful read-only input run includes a back button", async () => {
    seedInputSession("return 'role:' + ctx.input.role;");
    const { interaction, edits } = buttonInteraction("scr:go:u-role-count");

    await onCollectorRun(interaction as never, "u-role-count");

    expect(edits).toHaveLength(1);
    expect(payloadText(edits[0])).toContain("role:r-vet");
    expect(payloadText(edits[0])).toContain("scr:back:u-role-count");
  });

  test("back returns to the collector with preserved input values", async () => {
    seedInputSession("return 'role:' + ctx.input.role;");
    const { interaction, updates } = buttonInteraction("scr:back:u-role-count");

    await onBackToInputs(interaction as never, "u-role-count");

    expect(updates).toHaveLength(1);
    expect(payloadText(updates[0])).toContain("<@&r-vet>");
    expect(payloadText(updates[0])).toContain("scr:go:u-role-count");
  });

  test("mutating dry-run includes apply and back buttons", async () => {
    seedInputSession('ctx.addRole(ctx.members[0], "Veteran"); return "ready";', ["roles"]);
    const { interaction, edits } = buttonInteraction("scr:go:u-role-count");

    await onCollectorRun(interaction as never, "u-role-count");

    expect(edits).toHaveLength(1);
    expect(payloadText(edits[0])).toContain("scr:apply:u-role-count");
    expect(payloadText(edits[0])).toContain("scr:back:u-role-count");
  });

  test("apply keeps the session and includes a back button", async () => {
    const key = seedInputSession('ctx.addRole(ctx.members[0], "Veteran"); return "applied";', [
      "roles",
    ]);
    const recorded: string[] = [];
    const { interaction, edits } = buttonInteraction("scr:apply:u-role-count", recorded);

    await onConfirmApply(interaction as never, "u-role-count");

    expect(sessions.has(key)).toBe(true);
    expect(recorded).toContain("add:u1:r-vet");
    expect(edits).toHaveLength(1);
    expect(payloadText(edits[0])).toContain("scr:back:u-role-count");
  });

  test("back reports an expired form when the session is gone", async () => {
    sessions.delete(sessionKey("user-1", "guild-1", "u-role-count"));
    const { interaction, updates } = buttonInteraction("scr:back:u-role-count");

    await onBackToInputs(interaction as never, "u-role-count");

    expect(updates).toHaveLength(1);
    expect(payloadText(updates[0])).toContain("This form expired");
  });
});

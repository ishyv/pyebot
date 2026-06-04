import { beforeEach, describe, expect, test } from "bun:test";
import { ChannelType } from "discord.js";
import { Ticket } from "@/components/ticket";
import { UserTickets, userTicketsId } from "@/components/user-tickets";
import { SessionManager } from "@/core/state";
import type { Component, Ctx } from "@/framework/types";
import { closeTicket, openTicket } from "./service";

type ComponentState = Map<string, Map<string, unknown>>;

interface FakeChannel {
  id: string;
  deleted: boolean;
  delete(reason?: string): Promise<void>;
}

function componentStore<T>(state: ComponentState, component: Component<T>): Map<string, T> {
  let store = state.get(component.collection) as Map<string, T> | undefined;
  if (!store) {
    store = new Map<string, T>();
    state.set(component.collection, store as Map<string, unknown>);
  }
  return store;
}

function fakeCtx(state: ComponentState, failOnSet = false): Ctx {
  const sessions = new SessionManager<unknown>();
  return {
    sessions,
    get: async <T>(id: string, component: Component<T>) =>
      componentStore(state, component).get(id) ?? null,
    ensure: async (id, component) => {
      const store = componentStore(state, component);
      const existing = store.get(id);
      if (existing) return existing;
      const parsed = component.schema.parse({});
      store.set(id, parsed);
      return parsed;
    },
    set: async (id, component, value) => {
      if (failOnSet) throw new Error("write failed");
      componentStore(state, component).set(id, value);
    },
    patch: async (id, component, patch) => {
      const store = componentStore(state, component);
      const current = (store.get(id) ?? component.schema.parse({})) as object;
      const nextPatch = typeof patch === "function" ? patch(current as never) : patch;
      store.set(id, { ...current, ...nextPatch } as never);
    },
    delete: async (id, component) => {
      componentStore(state, component).delete(id);
    },
    query: async () => [],
    emit: async () => {},
    client: {} as never,
    logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} } as never,
    cooldowns: {} as never,
    locks: {} as never,
    interaction: null,
    respond: {} as never,
    of: (() => {
      throw new Error("entity API not used in this mock");
    }) as Ctx["of"],
    select: (() => {
      throw new Error("entity API not used in this mock");
    }) as Ctx["select"],
    transaction: (() => {
      throw new Error("entity API not used in this mock");
    }) as Ctx["transaction"],
  };
}

function fakeGuild(channel: FakeChannel) {
  return {
    id: "guild-1",
    channels: {
      cache: new Map([[channel.id, channel]]),
      create: async (options: { name: string; type: ChannelType; parent: string }) => {
        expect(options).toEqual({
          name: "ticket-user",
          type: ChannelType.GuildText,
          parent: "category-1",
        });
        return channel;
      },
      fetch: async (channelId: string) => (channelId === channel.id ? channel : null),
    },
  } as never;
}

function fakeChannel(id = "channel-1"): FakeChannel {
  return {
    id,
    deleted: false,
    async delete() {
      this.deleted = true;
    },
  };
}

let state: ComponentState;

beforeEach(() => {
  state = new Map();
});

describe("ticket persistence", () => {
  test("rejects when the user already has an open ticket", async () => {
    componentStore(state, UserTickets).set(userTicketsId("guild-1", "user-1"), {
      openChannelIds: ["existing-channel"],
    });

    const channel = fakeChannel();
    const result = await openTicket(fakeCtx(state), fakeGuild(channel), "user-1", {
      categoryId: "category-1",
      channelName: "ticket-user",
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toBe("You already have an open ticket.");
    expect(channel.deleted).toBe(false);
  });

  test("creates the channel and writes ticket components", async () => {
    const channel = fakeChannel();
    const ctx = fakeCtx(state);

    const result = await openTicket(ctx, fakeGuild(channel), "user-1", {
      categoryId: "category-1",
      channelName: "ticket-user",
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ channelId: "channel-1" });
    expect(componentStore(state, Ticket).get("channel-1")).toMatchObject({
      guildId: "guild-1",
      ownerId: "user-1",
      category: "general",
    });
    expect(componentStore(state, UserTickets).get(userTicketsId("guild-1", "user-1"))).toEqual({
      openChannelIds: ["channel-1"],
    });
    expect(ctx.sessions.get("ticket:guild-1:user-1")).toBe("channel-1");
  });

  test("cleans up a created channel when persistence fails", async () => {
    const channel = fakeChannel();

    const result = await openTicket(fakeCtx(state, true), fakeGuild(channel), "user-1", {
      categoryId: "category-1",
      channelName: "ticket-user",
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toBe("Failed to record ticket in DB.");
    expect(channel.deleted).toBe(true);
  });

  test("closes a ticket and clears component state", async () => {
    const channel = fakeChannel();
    const ctx = fakeCtx(state);
    componentStore(state, Ticket).set("channel-1", {
      guildId: "guild-1",
      ownerId: "user-1",
      category: "general",
      createdAt: new Date(),
    });
    componentStore(state, UserTickets).set(userTicketsId("guild-1", "user-1"), {
      openChannelIds: ["channel-1", "channel-2"],
    });
    ctx.sessions.set("ticket:guild-1:user-1", "channel-1");

    const result = await closeTicket(ctx, fakeGuild(channel), "channel-1", "user-1");

    expect(result.isOk()).toBe(true);
    expect(channel.deleted).toBe(true);
    expect(componentStore(state, Ticket).has("channel-1")).toBe(false);
    expect(componentStore(state, UserTickets).get(userTicketsId("guild-1", "user-1"))).toEqual({
      openChannelIds: ["channel-2"],
    });
    expect(ctx.sessions.get("ticket:guild-1:user-1")).toBeUndefined();
  });

  test("infers the ticket owner when close omits ownerId", async () => {
    const channel = fakeChannel();
    const ctx = fakeCtx(state);
    componentStore(state, Ticket).set("channel-1", {
      guildId: "guild-1",
      ownerId: "user-1",
      category: "general",
      createdAt: new Date(),
    });
    componentStore(state, UserTickets).set(userTicketsId("guild-1", "user-1"), {
      openChannelIds: ["channel-1"],
    });
    ctx.sessions.set("ticket:guild-1:user-1", "channel-1");

    const result = await closeTicket(ctx, fakeGuild(channel), "channel-1");

    expect(result.isOk()).toBe(true);
    expect(componentStore(state, Ticket).has("channel-1")).toBe(false);
    expect(componentStore(state, UserTickets).get(userTicketsId("guild-1", "user-1"))).toEqual({
      openChannelIds: [],
    });
    expect(ctx.sessions.get("ticket:guild-1:user-1")).toBeUndefined();
  });
});

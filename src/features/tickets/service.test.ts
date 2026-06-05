import { beforeEach, describe, expect, test } from "bun:test";
import { ChannelType } from "discord.js";
import { Ticket, User } from "@/components/entities";
import { TicketRecord, type TicketValue } from "@/components/ticket";
import { UserTickets, type UserTicketsValue } from "@/components/user-tickets";
import { SessionManager } from "@/core/state";
import type { Ctx } from "@/framework/types";
import { closeTicket, openTicket } from "./service";

interface TicketState {
  tickets: Map<string, TicketValue>;
  userTickets: Map<string, UserTicketsValue>;
}

interface FakeChannel {
  id: string;
  deleted: boolean;
  delete(reason?: string): Promise<void>;
}

/** Entity ctx backing the `Ticket` kind (by channel id) and `UserTickets` on `User`. */
function fakeCtx(state: TicketState, failOnSet = false): Ctx {
  const sessions = new SessionManager<unknown>();
  return {
    sessions,
    of(kind: unknown, id: string) {
      if (kind === Ticket) {
        return {
          async peek(component: unknown) {
            if (component !== TicketRecord) throw new Error("unexpected component");
            return state.tickets.get(id) ?? null;
          },
          async set(component: unknown, value: unknown) {
            if (component !== TicketRecord) throw new Error("unexpected component");
            if (failOnSet) throw new Error("write failed");
            state.tickets.set(id, value as TicketValue);
          },
          async remove(component: unknown) {
            if (component !== TicketRecord) throw new Error("unexpected component");
            state.tickets.delete(id);
          },
        };
      }
      if (kind === User) {
        return {
          async get(component: unknown) {
            if (component !== UserTickets) throw new Error("unexpected component");
            return state.userTickets.get(id) ?? UserTickets.schema.parse({});
          },
          async update(component: unknown, patch: unknown) {
            if (component !== UserTickets) throw new Error("unexpected component");
            const current = state.userTickets.get(id) ?? UserTickets.schema.parse({});
            const partial = typeof patch === "function" ? patch(current) : patch;
            state.userTickets.set(id, { ...current, ...(partial as Partial<UserTicketsValue>) });
          },
        };
      }
      throw new Error("unexpected entity kind");
    },
    emit: async () => {},
    client: {} as never,
    logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} } as never,
    cooldowns: {} as never,
    locks: {} as never,
    interaction: null,
    respond: {} as never,
    get: (() => {
      throw new Error("legacy get not used");
    }) as Ctx["get"],
    ensure: (() => {
      throw new Error("legacy ensure not used");
    }) as Ctx["ensure"],
    set: (() => {
      throw new Error("legacy set not used");
    }) as Ctx["set"],
    patch: (() => {
      throw new Error("legacy patch not used");
    }) as Ctx["patch"],
    delete: (() => {
      throw new Error("legacy delete not used");
    }) as Ctx["delete"],
    query: (() => {
      throw new Error("legacy query not used");
    }) as Ctx["query"],
    select: (() => {
      throw new Error("select not used");
    }) as Ctx["select"],
    transaction: (() => {
      throw new Error("transaction not used");
    }) as Ctx["transaction"],
  } as unknown as Ctx;
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

let state: TicketState;

beforeEach(() => {
  state = { tickets: new Map(), userTickets: new Map() };
});

describe("ticket persistence", () => {
  test("rejects when the user already has an open ticket", async () => {
    state.userTickets.set("user-1", { openByGuild: { "guild-1": ["existing-channel"] } });

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
    expect(state.tickets.get("channel-1")).toMatchObject({
      guildId: "guild-1",
      ownerId: "user-1",
      category: "general",
    });
    expect(state.userTickets.get("user-1")).toEqual({
      openByGuild: { "guild-1": ["channel-1"] },
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
    state.tickets.set("channel-1", {
      guildId: "guild-1",
      ownerId: "user-1",
      category: "general",
      createdAt: new Date(),
    });
    state.userTickets.set("user-1", { openByGuild: { "guild-1": ["channel-1", "channel-2"] } });
    ctx.sessions.set("ticket:guild-1:user-1", "channel-1");

    const result = await closeTicket(ctx, fakeGuild(channel), "channel-1", "user-1");

    expect(result.isOk()).toBe(true);
    expect(channel.deleted).toBe(true);
    expect(state.tickets.has("channel-1")).toBe(false);
    expect(state.userTickets.get("user-1")).toEqual({
      openByGuild: { "guild-1": ["channel-2"] },
    });
    expect(ctx.sessions.get("ticket:guild-1:user-1")).toBeUndefined();
  });

  test("infers the ticket owner when close omits ownerId", async () => {
    const channel = fakeChannel();
    const ctx = fakeCtx(state);
    state.tickets.set("channel-1", {
      guildId: "guild-1",
      ownerId: "user-1",
      category: "general",
      createdAt: new Date(),
    });
    state.userTickets.set("user-1", { openByGuild: { "guild-1": ["channel-1"] } });
    ctx.sessions.set("ticket:guild-1:user-1", "channel-1");

    const result = await closeTicket(ctx, fakeGuild(channel), "channel-1");

    expect(result.isOk()).toBe(true);
    expect(state.tickets.has("channel-1")).toBe(false);
    expect(state.userTickets.get("user-1")).toEqual({ openByGuild: { "guild-1": [] } });
    expect(ctx.sessions.get("ticket:guild-1:user-1")).toBeUndefined();
  });
});

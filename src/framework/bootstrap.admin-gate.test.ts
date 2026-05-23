import { beforeEach, describe, expect, it, mock } from "bun:test";
import { MessageFlags } from "discord.js";

let commandExecutions = 0;
let isAdminInteraction = false;
let featureOverrides: Record<string, boolean> = {};

const adminCommand = {
  data: { name: "secure", toJSON: () => ({ name: "secure" }) },
  help: false,
  requiresAdmin: true,
  execute: async () => {
    commandExecutions += 1;
  },
};

mock.module("./loader", () => ({
  loadFeatures: async () => [
    {
      descriptor: {
        id: "secure-feature",
        name: "Secure Feature",
        description: "Feature with an admin command",
      },
      commands: [adminCommand],
      handlers: null,
    },
  ],
}));

mock.module("./world", () => ({
  World: {
    create: async () => ({
      forInteraction: () => ({
        get: async () => ({ overrides: featureOverrides }),
      }),
    }),
  },
}));

function fakeClient() {
  return { on: () => undefined };
}

function chatInput(commandName: string) {
  const replies: unknown[] = [];
  return {
    replies,
    interaction: {
      commandName,
      guildId: "guild-1",
      memberPermissions: {
        has: () => isAdminInteraction,
      },
      isChatInputCommand: () => true,
      isAutocomplete: () => false,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isChannelSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isModalSubmit: () => false,
      isRepliable: () => true,
      reply: async (payload: unknown) => {
        replies.push(payload);
      },
    },
  };
}

beforeEach(() => {
  commandExecutions = 0;
  isAdminInteraction = false;
  featureOverrides = {};
});

describe("bootstrap admin command gate", () => {
  it("rejects requiresAdmin commands for non-admin members", async () => {
    const { bootstrapFramework } = await import("./bootstrap");
    const app = await bootstrapFramework(fakeClient() as never);
    const { interaction, replies } = chatInput("secure");

    await app.dispatch(interaction as never);

    expect(commandExecutions).toBe(0);
    expect(replies).toEqual([
      {
        content: "You need Manage Server permission to use this command.",
        flags: MessageFlags.Ephemeral,
      },
    ]);
  });

  it("allows requiresAdmin commands for admins", async () => {
    isAdminInteraction = true;
    const { bootstrapFramework } = await import("./bootstrap");
    const app = await bootstrapFramework(fakeClient() as never);
    const { interaction, replies } = chatInput("secure");

    await app.dispatch(interaction as never);

    expect(commandExecutions).toBe(1);
    expect(replies).toEqual([]);
  });

  it("uses MessageFlags.Ephemeral for unknown commands", async () => {
    const { bootstrapFramework } = await import("./bootstrap");
    const app = await bootstrapFramework(fakeClient() as never);
    const { interaction, replies } = chatInput("missing");

    await app.dispatch(interaction as never);

    expect(replies).toEqual([{ content: "Unknown command.", flags: MessageFlags.Ephemeral }]);
  });

  it("uses MessageFlags.Ephemeral for disabled feature replies", async () => {
    featureOverrides = { "secure-feature": false };
    const { bootstrapFramework } = await import("./bootstrap");
    const app = await bootstrapFramework(fakeClient() as never);
    const { interaction, replies } = chatInput("secure");

    await app.dispatch(interaction as never);

    expect(commandExecutions).toBe(0);
    expect(replies).toEqual([
      {
        content:
          "The **Secure Feature** feature is disabled on this server. An admin can enable it with `/features enable secure-feature`.",
        flags: MessageFlags.Ephemeral,
      },
    ]);
  });
});

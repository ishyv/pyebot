import { describe, expect, it, mock } from "bun:test";
import { ErrResult, OkResult } from "@/core/result";

const updateCalls: Array<{
  guildId: string;
  paths: Record<string, unknown>;
  options: unknown;
}> = [];
const bannedImageCalls: Array<{ type: string; args: unknown[] }> = [];
const invalidatedGuilds: string[] = [];

interface TestGuild {
  _id: string;
  automod: {
    domainWhitelist: {
      enabled: boolean;
      domains: string[];
    };
    textRules: unknown[];
    customPatterns: unknown[];
  };
}

let updateResult = OkResult(undefined);
let activeBannedImages: unknown[] = [];
let activeGuild: TestGuild | null = null;

mock.module("@/db/repositories/guilds", () => ({
  guildStore: {},
  ensureGuild: async () => OkResult(null),
  getGuild: async () => OkResult(activeGuild),
  patchGuild: async () => OkResult(null),
  updateGuildPaths: async (guildId: string, paths: Record<string, unknown>, options: unknown) => {
    updateCalls.push({ guildId, paths, options });
    return updateResult;
  },
}));

mock.module("@/features/automod/service", () => ({
  invalidatePatternCache: (guildId: string) => {
    invalidatedGuilds.push(guildId);
  },
}));

mock.module("@/features/adminPanels/panels", () => ({
  assertPanelPermission: async () => true,
  openAdminPanel: async () => undefined,
}));

mock.module("@/features/automod/imageHash", () => ({
  hashImageBuffer: async () => ({
    average: "ffff0000ffff0000",
    difference: "0000ffff0000ffff",
    verticalDifference: "f0f0f0f00f0f0f0f",
  }),
}));

mock.module("@/features/automod/bannedImages", () => ({
  addBannedImage: async (...args: unknown[]) => {
    bannedImageCalls.push({ type: "addBannedImage", args });
    return {
      id: "image-1",
      guildId: "guild-1",
      status: "active",
      reason: "scam image",
      label: "scam",
    };
  },
  displayBannedImageId: (record: { id: string }) => record.id,
  fetchImageAttachmentBuffer: async (...args: unknown[]) => {
    bannedImageCalls.push({ type: "fetchImageAttachmentBuffer", args });
    return Buffer.from("image");
  },
  isSupportedImageAttachment: () => true,
  listActiveBannedImages: async (...args: unknown[]) => {
    bannedImageCalls.push({ type: "listActiveBannedImages", args });
    return activeBannedImages;
  },
  removeBannedImage: async (...args: unknown[]) => {
    bannedImageCalls.push({ type: "removeBannedImage", args });
    return {
      id: "image-1",
      guildId: "guild-1",
      status: "removed",
      reason: "scam image",
      label: "scam",
    };
  },
}));

function makeGuild(overrides: Partial<{ domains: string[]; patterns: unknown[] }> = {}) {
  return {
    _id: "guild-1",
    automod: {
      domainWhitelist: {
        enabled: true,
        domains: overrides.domains ?? [],
      },
      textRules: [],
      customPatterns: overrides.patterns ?? [],
    },
  };
}

function linkspamInteraction() {
  return automodInteraction("linkspam", {
    strings: {
      action: "enable",
      response: "delete",
    },
    integers: {
      max_links: 2,
      window_seconds: 5,
    },
  });
}

function automodInteraction(
  subcommand: string,
  values: {
    strings?: Record<string, string | null>;
    integers?: Record<string, number | null>;
    booleans?: Record<string, boolean | null>;
    channels?: Record<string, { id: string } | null>;
  } = {},
) {
  return {
    guildId: "guild-1",
    guild: { id: "guild-1" },
    user: { id: "mod-1" },
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string, required?: boolean) => {
        const value = values.strings?.[name] ?? null;
        if (required && value === null) throw new Error(`missing ${name}`);
        return value;
      },
      getInteger: (name: string) => {
        return values.integers?.[name] ?? null;
      },
      getBoolean: (name: string) => {
        return values.booleans?.[name] ?? null;
      },
      getChannel: (name: string) => {
        return values.channels?.[name] ?? null;
      },
    },
    async deferReply() {
      throw new Error("automod commands must use ctx.respond instead of raw deferReply");
    },
    async editReply() {
      throw new Error("automod commands must use ctx.respond instead of raw editReply");
    },
  };
}

function imageInteraction(subcommand: string) {
  return {
    guildId: "guild-1",
    guild: { id: "guild-1" },
    user: { id: "mod-1" },
    options: {
      getSubcommand: () => subcommand,
      getAttachment: (name: string, required?: boolean) => {
        if (name !== "image" && required) throw new Error(`missing ${name}`);
        return {
          id: "attachment-1",
          url: "https://cdn.example/image.png",
          contentType: "image/png",
          name: "image.png",
          size: 32,
        };
      },
      getString: (name: string, required?: boolean) => {
        const values: Record<string, string> = {
          reason: "scam image",
          label: "scam",
          id: "image-1",
          action: "enable",
        };
        const value = values[name] ?? null;
        if (required && value === null) throw new Error(`missing ${name}`);
        return value;
      },
      getInteger: () => null,
      getBoolean: () => null,
      getChannel: () => ({ id: "reports" }),
    },
  };
}

function fakeContext() {
  const calls: Array<{ method: string; payload?: unknown; options?: unknown }> = [];
  return {
    calls,
    ctx: {
      guildId: "guild-1",
      respond: {
        async defer(options: unknown) {
          calls.push({ method: "defer", options });
        },
        async send(payload: unknown) {
          calls.push({ method: "send", payload });
        },
        async fail(payload: unknown) {
          calls.push({ method: "fail", payload });
        },
      },
    },
  };
}

describe("/automod linkspam", () => {
  it("uses the framework responder and upserts the latest guild config shape", async () => {
    updateCalls.length = 0;
    updateResult = OkResult(undefined);
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(linkspamInteraction() as never, ctx as never);

    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
    expect(updateCalls).toEqual([
      {
        guildId: "guild-1",
        paths: {
          "automod.linkSpam.enabled": true,
          "automod.linkSpam.maxLinks": 2,
          "automod.linkSpam.windowSeconds": 5,
          "automod.linkSpam.action": "delete",
        },
        options: { upsert: true },
      },
    ]);
  });

  it("reports persistence failures through the framework responder", async () => {
    updateCalls.length = 0;
    updateResult = ErrResult(new Error("db down"));
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(linkspamInteraction() as never, ctx as never);

    expect(calls.map((call) => call.method)).toEqual(["defer", "fail"]);
  });
});

describe("/automod command decomposition", () => {
  it("keeps the slash data and subcommand table in focused modules", async () => {
    const [{ data }, { automodSubcommands }] = await Promise.all([
      import("../automod-data"),
      import("./subcommands"),
    ]);

    expect(data.name).toBe("automod");
    expect(typeof automodSubcommands.linkspam).toBe("function");
    expect(typeof automodSubcommands["image-list"]).toBe("function");
    expect(typeof automodSubcommands.panel).toBe("function");
  });
});

describe("/automod config subcommands", () => {
  it("adds a text rule when the guild config has not been created yet", async () => {
    updateCalls.length = 0;
    invalidatedGuilds.length = 0;
    updateResult = OkResult(undefined);
    activeGuild = null;
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(
      automodInteraction("text", {
        strings: {
          action: "add",
          id: "nword",
          phrase: "badword",
          response: "delete",
        },
      }) as never,
      ctx as never,
    );

    expect(updateCalls.map((call) => call.paths)).toEqual([
      {
        "automod.textRules": [
          {
            id: "nword",
            enabled: true,
            phrases: ["badword"],
            action: "delete",
            timeoutSeconds: 300,
          },
        ],
      },
    ]);
    expect(invalidatedGuilds).toEqual(["guild-1"]);
    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
  });

  it("adds multiple phrases under one text rule id", async () => {
    updateCalls.length = 0;
    invalidatedGuilds.length = 0;
    updateResult = OkResult(undefined);
    activeGuild = makeGuild();
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(
      automodInteraction("text", {
        strings: {
          action: "add",
          id: "blocked",
          phrase: "badword, worse word",
          response: "delete",
        },
      }) as never,
      ctx as never,
    );

    expect(updateCalls.map((call) => call.paths)).toEqual([
      {
        "automod.textRules": [
          {
            id: "blocked",
            enabled: true,
            phrases: ["badword", "worse word"],
            action: "delete",
            timeoutSeconds: 300,
          },
        ],
      },
    ]);
    expect(invalidatedGuilds).toEqual(["guild-1"]);
    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
  });

  it("extends an existing text rule id without replacing its action", async () => {
    updateCalls.length = 0;
    invalidatedGuilds.length = 0;
    updateResult = OkResult(undefined);
    activeGuild = {
      ...makeGuild(),
      automod: {
        ...makeGuild().automod,
        textRules: [
          {
            id: "blocked",
            enabled: true,
            phrases: ["badword"],
            action: "timeout",
            timeoutSeconds: 900,
          },
        ],
      },
    };
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(
      automodInteraction("text", {
        strings: {
          action: "add",
          id: "blocked",
          phrase: "worse word",
        },
      }) as never,
      ctx as never,
    );

    expect(updateCalls.map((call) => call.paths)).toEqual([
      {
        "automod.textRules": [
          {
            id: "blocked",
            enabled: true,
            phrases: ["badword", "worse word"],
            action: "timeout",
            timeoutSeconds: 900,
          },
        ],
      },
    ]);
    expect(invalidatedGuilds).toEqual(["guild-1"]);
    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
  });

  it("writes cross-channel, slowmode, raid, and policy config paths", async () => {
    updateCalls.length = 0;
    updateResult = OkResult(undefined);
    const { default: command } = await import("./automod");
    const { ctx } = fakeContext();

    await command.execute(
      automodInteraction("crosschannel", {
        strings: { action: "enable" },
        integers: { min_channels: 4, window_seconds: 45, timeout_seconds: 900 },
        booleans: { auto_timeout: false },
        channels: { report_channel: { id: "reports" } },
      }) as never,
      ctx as never,
    );
    await command.execute(
      automodInteraction("slowmode", {
        strings: { action: "enable" },
        integers: {
          messages_per_window: 25,
          window_seconds: 60,
          slowmode_seconds: 10,
          release_after: 120,
        },
      }) as never,
      ctx as never,
    );
    await command.execute(
      automodInteraction("raid", {
        strings: { action: "enable", response: "alert" },
        integers: { joins_per_minute: 12, min_account_age: 5 },
        channels: { report_channel: { id: "raid-reports" } },
      }) as never,
      ctx as never,
    );
    await command.execute(
      automodInteraction("policy", {
        strings: { preset: "strict" },
        booleans: { ai_detector: true, staff_bypass: false },
        integers: { retention_days: 60 },
      }) as never,
      ctx as never,
    );

    expect(updateCalls.map((call) => call.paths)).toEqual([
      {
        "automod.crossChannelSpam.enabled": true,
        "automod.crossChannelSpam.minChannels": 4,
        "automod.crossChannelSpam.windowSeconds": 45,
        "automod.crossChannelSpam.reportChannelId": "reports",
        "automod.crossChannelSpam.autoTimeout": false,
        "automod.crossChannelSpam.timeoutSeconds": 900,
      },
      {
        "automod.slowmode.enabled": true,
        "automod.slowmode.messagesPerWindow": 25,
        "automod.slowmode.windowSeconds": 60,
        "automod.slowmode.slowmodeSeconds": 10,
        "automod.slowmode.releaseAfterSeconds": 120,
      },
      {
        "automod.raidDetection.enabled": true,
        "automod.raidDetection.joinsPerMinute": 12,
        "automod.raidDetection.minAccountAgeDays": 5,
        "automod.raidDetection.action": "alert",
        "automod.raidDetection.reportChannelId": "raid-reports",
      },
      {
        "automod.policy.preset": "strict",
        "automod.policy.aiDetector.enabled": true,
        "automod.policy.bypass.staffBypass": false,
        "automod.policy.profileRetentionDays": 60,
      },
    ]);
  });

  it("preserves whitelist add/remove messages and writes", async () => {
    updateCalls.length = 0;
    activeGuild = makeGuild({ domains: ["old.example"] });
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(
      automodInteraction("whitelist", {
        strings: { action: "add", domain: "New.Example" },
      }) as never,
      ctx as never,
    );
    await command.execute(
      automodInteraction("whitelist", {
        strings: { action: "remove", domain: "old.example" },
      }) as never,
      ctx as never,
    );

    expect(updateCalls.map((call) => call.paths)).toEqual([
      {
        "automod.domainWhitelist.enabled": true,
        "automod.domainWhitelist.domains": ["old.example", "new.example"],
      },
      {
        "automod.domainWhitelist.enabled": true,
        "automod.domainWhitelist.domains": [],
      },
    ]);
    expect(calls.map((call) => call.method)).toEqual(["defer", "send", "defer", "send"]);
  });

  it("preserves pattern add/remove/list behavior and invalidates cache on writes", async () => {
    updateCalls.length = 0;
    invalidatedGuilds.length = 0;
    activeGuild = makeGuild({
      patterns: [
        {
          name: "invite",
          pattern: "discord\\.gg",
          flags: "i",
          action: "delete",
          timeoutSeconds: 300,
        },
      ],
    });
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(
      automodInteraction("pattern", {
        strings: { action: "list" },
      }) as never,
      ctx as never,
    );
    await command.execute(
      automodInteraction("pattern", {
        strings: { action: "remove", name: "invite" },
      }) as never,
      ctx as never,
    );
    activeGuild = makeGuild({ patterns: [] });
    await command.execute(
      automodInteraction("pattern", {
        strings: {
          action: "add",
          name: "invite",
          regex: "discord\\.gg",
          flags: "i",
          response: "delete",
        },
        integers: { timeout_seconds: 300 },
      }) as never,
      ctx as never,
    );

    expect(updateCalls.map((call) => call.paths)).toEqual([
      { "automod.customPatterns": [] },
      {
        "automod.customPatterns": [
          {
            name: "invite",
            pattern: "discord\\.gg",
            flags: "i",
            action: "delete",
            timeoutSeconds: 300,
          },
        ],
      },
    ]);
    expect(invalidatedGuilds).toEqual(["guild-1", "guild-1"]);
    expect(JSON.stringify(calls)).toContain("discord\\\\.gg");
  });

  it("manages plain text rules without asking moderators for regex", async () => {
    updateCalls.length = 0;
    invalidatedGuilds.length = 0;
    activeGuild = {
      ...makeGuild(),
      automod: {
        ...makeGuild().automod,
        textRules: [
          {
            id: "badword",
            enabled: true,
            phrases: ["badword"],
            action: "delete",
            timeoutSeconds: 300,
          },
        ],
      },
    };
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(
      automodInteraction("text", {
        strings: { action: "list" },
      }) as never,
      ctx as never,
    );
    await command.execute(
      automodInteraction("text", {
        strings: { action: "remove", id: "badword" },
      }) as never,
      ctx as never,
    );
    activeGuild = makeGuild();
    await command.execute(
      automodInteraction("text", {
        strings: {
          action: "add",
          id: "badword",
          phrase: "badword",
          response: "timeout",
        },
        integers: { timeout_seconds: 900 },
      }) as never,
      ctx as never,
    );

    expect(updateCalls.map((call) => call.paths)).toEqual([
      { "automod.textRules": [] },
      {
        "automod.textRules": [
          {
            id: "badword",
            enabled: true,
            phrases: ["badword"],
            action: "timeout",
            timeoutSeconds: 900,
          },
        ],
      },
    ]);
    expect(invalidatedGuilds).toEqual(["guild-1", "guild-1"]);
    expect(JSON.stringify(calls)).toContain("badword");
  });
});

describe("/automod banned images", () => {
  it("adds a banned image through the framework responder", async () => {
    bannedImageCalls.length = 0;
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(imageInteraction("image-add") as never, ctx as never);

    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
    expect(bannedImageCalls.map((call) => call.type)).toEqual([
      "fetchImageAttachmentBuffer",
      "addBannedImage",
    ]);
    expect(bannedImageCalls[1]?.args[1]).toMatchObject({
      guildId: "guild-1",
      actorId: "mod-1",
      reason: "scam image",
      label: "scam",
      sourceUrl: "https://cdn.example/image.png",
    });
  });

  it("lists active banned images", async () => {
    bannedImageCalls.length = 0;
    activeBannedImages = [
      {
        id: "image-1",
        guildId: "guild-1",
        reason: "scam image",
        label: "scam",
      },
    ];
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(imageInteraction("image-list") as never, ctx as never);

    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
    expect(bannedImageCalls[0]?.type).toBe("listActiveBannedImages");
    expect(bannedImageCalls[0]?.args[1]).toBe("guild-1");
  });

  it("soft-removes a banned image by id", async () => {
    bannedImageCalls.length = 0;
    const { default: command } = await import("./automod");
    const { ctx, calls } = fakeContext();

    await command.execute(imageInteraction("image-remove") as never, ctx as never);

    expect(calls.map((call) => call.method)).toEqual(["defer", "send"]);
    expect(bannedImageCalls[0]?.type).toBe("removeBannedImage");
    expect(bannedImageCalls[0]?.args.slice(1)).toEqual(["guild-1", "image-1", "mod-1"]);
  });

  it("toggles image detection and sets the image report channel", async () => {
    updateCalls.length = 0;
    updateResult = OkResult(undefined);
    const { default: command } = await import("./automod");
    const { ctx } = fakeContext();

    await command.execute(imageInteraction("image-toggle") as never, ctx as never);
    await command.execute(imageInteraction("image-channel") as never, ctx as never);

    expect(updateCalls).toEqual([
      {
        guildId: "guild-1",
        paths: { "automod.imageDetection.enabled": true },
        options: { upsert: true },
      },
      {
        guildId: "guild-1",
        paths: { "automod.imageDetection.reportChannelId": "reports" },
        options: { upsert: true },
      },
    ]);
  });
});

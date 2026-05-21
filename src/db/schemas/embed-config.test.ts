import { describe, expect, test } from "bun:test";
import {
  type EmbedConfig,
  EmbedConfigSchema,
  type EmbedField,
  EmbedFieldSchema,
  EMBED_LIMITS,
  EmbedDraftInputSchema,
  embedTotalLength,
  SCHEDULE_INTERVAL_HOURS,
  type ScheduleIntervalHours,
} from "./embed-config";

describe("EmbedConfigSchema", () => {
  test("parses a fully valid document with all fields", () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const input = {
      _id: "guild123:my-embed",
      guildId: "guild123",
      name: "my-embed",
      createdBy: "user456",
      embedTitle: "Hello World",
      embedDescription: "A description",
      embedColor: 0xff0000,
      embedUrl: "https://example.com",
      embedThumbnail: "https://example.com/thumb.png",
      embedImage: "https://example.com/image.png",
      embedAuthorName: "Author",
      embedAuthorIconUrl: "https://example.com/icon.png",
      embedAuthorUrl: "https://example.com/author",
      embedFooterText: "Footer text",
      embedFooterIconUrl: "https://example.com/footer.png",
      embedFields: [{ name: "Field 1", value: "Value 1", inline: true }],
      script: "return { title: 'Dynamic' };",
      scriptEnabled: true,
      channelId: "channel789",
      scheduleEnabled: true,
      scheduleIntervalHours: 24,
      scheduledNextSendAt: now.toISOString(),
      scheduledLastSentAt: now.toISOString(),
      stickyEnabled: true,
      stickyMessageId: "msg123",
      stickyLastResendAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const result = EmbedConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.data;
    expect(data._id).toBe("guild123:my-embed");
    expect(data.guildId).toBe("guild123");
    expect(data.name).toBe("my-embed");
    expect(data.createdBy).toBe("user456");
    expect(data.embedTitle).toBe("Hello World");
    expect(data.embedColor).toBe(0xff0000);
    expect(data.scheduleIntervalHours).toBe(24);
    expect(data.embedFields).toHaveLength(1);
    expect(data.embedFields[0].name).toBe("Field 1");
    expect(data.embedFields[0].inline).toBe(true);
    expect(data.scheduledNextSendAt).toEqual(now);
    expect(data.stickyEnabled).toBe(true);
    expect(data.scriptEnabled).toBe(true);
  });

  test("parses a minimal document with correct defaults", () => {
    const input = {
      _id: "guild123:simple",
      guildId: "guild123",
      name: "simple",
      createdBy: "user456",
    };

    const result = EmbedConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.data;
    expect(data._id).toBe("guild123:simple");
    expect(data.guildId).toBe("guild123");
    expect(data.name).toBe("simple");
    expect(data.createdBy).toBe("user456");

    // Nullable fields default to null
    expect(data.embedTitle).toBeNull();
    expect(data.embedDescription).toBeNull();
    expect(data.embedColor).toBeNull();
    expect(data.embedUrl).toBeNull();
    expect(data.embedThumbnail).toBeNull();
    expect(data.embedImage).toBeNull();
    expect(data.embedAuthorName).toBeNull();
    expect(data.embedAuthorIconUrl).toBeNull();
    expect(data.embedAuthorUrl).toBeNull();
    expect(data.embedFooterText).toBeNull();
    expect(data.embedFooterIconUrl).toBeNull();
    expect(data.script).toBeNull();
    expect(data.channelId).toBeNull();
    expect(data.scheduleIntervalHours).toBeNull();
    expect(data.scheduledNextSendAt).toBeNull();
    expect(data.scheduledLastSentAt).toBeNull();
    expect(data.stickyMessageId).toBeNull();
    expect(data.stickyLastResendAt).toBeNull();

    // Boolean fields default to false
    expect(data.scriptEnabled).toBe(false);
    expect(data.scheduleEnabled).toBe(false);
    expect(data.stickyEnabled).toBe(false);

    // Array field defaults to empty array
    expect(data.embedFields).toEqual([]);

    // Date fields get defaults (coerced to Date instances)
    expect(data.createdAt).toBeInstanceOf(Date);
    expect(data.updatedAt).toBeInstanceOf(Date);
  });

  test("invalid scheduleIntervalHours (e.g. 999) becomes null via catch", () => {
    const input = {
      _id: "guild123:sched",
      guildId: "guild123",
      name: "sched",
      createdBy: "user456",
      scheduleIntervalHours: 999,
    };

    const result = EmbedConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scheduleIntervalHours).toBeNull();
  });

  test("embedFields with invalid entries falls back to empty array via catch", () => {
    const input = {
      _id: "guild123:fields",
      guildId: "guild123",
      name: "fields",
      createdBy: "user456",
      embedFields: "not-an-array",
    };

    const result = EmbedConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.embedFields).toEqual([]);
  });

  test("createdAt as ISO string is coerced to a Date instance", () => {
    const isoString = "2024-06-01T10:30:00.000Z";
    const input = {
      _id: "guild123:dates",
      guildId: "guild123",
      name: "dates",
      createdBy: "user456",
      createdAt: isoString,
      updatedAt: isoString,
    };

    const result = EmbedConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.createdAt).toBeInstanceOf(Date);
    expect(result.data.createdAt.toISOString()).toBe(isoString);
    expect(result.data.updatedAt).toBeInstanceOf(Date);
  });

  test("all valid scheduleIntervalHours values are accepted", () => {
    for (const hours of SCHEDULE_INTERVAL_HOURS) {
      const input = {
        _id: "guild123:iv",
        guildId: "guild123",
        name: "iv",
        createdBy: "user456",
        scheduleIntervalHours: hours,
      };
      const result = EmbedConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scheduleIntervalHours).toBe(hours);
      }
    }
  });
});

describe("EmbedFieldSchema", () => {
  test("parses a valid field", () => {
    const result = EmbedFieldSchema.safeParse({ name: "Field", value: "Value", inline: true });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe("Field");
    expect(result.data.value).toBe("Value");
    expect(result.data.inline).toBe(true);
  });

  test("inline defaults to false via catch when invalid", () => {
    const result = EmbedFieldSchema.safeParse({ name: "F", value: "V", inline: "yes" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.inline).toBe(false);
  });
});

describe("Exported types (compile-time check via usage)", () => {
  test("EmbedConfig type is usable", () => {
    const config: EmbedConfig = {
      _id: "g:n",
      guildId: "g",
      name: "n",
      createdBy: "u",
      embedTitle: null,
      embedDescription: null,
      embedColor: null,
      embedUrl: null,
      embedThumbnail: null,
      embedImage: null,
      embedAuthorName: null,
      embedAuthorIconUrl: null,
      embedAuthorUrl: null,
      embedFooterText: null,
      embedFooterIconUrl: null,
      embedFields: [],
      script: null,
      scriptEnabled: false,
      channelId: null,
      scheduleEnabled: false,
      scheduleIntervalHours: null,
      scheduledNextSendAt: null,
      scheduledLastSentAt: null,
      stickyEnabled: false,
      stickyMessageId: null,
      stickyLastResendAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(config._id).toBe("g:n");
  });

  test("EmbedField type is usable", () => {
    const field: EmbedField = { name: "Name", value: "Value", inline: false };
    expect(field.name).toBe("Name");
  });

  test("ScheduleIntervalHours type accepts only valid values", () => {
    const h: ScheduleIntervalHours = 168;
    expect(SCHEDULE_INTERVAL_HOURS).toContain(h);
  });
});

describe("embedTotalLength", () => {
  test("counts title, description, author, footer, and every field name + value", () => {
    expect(
      embedTotalLength({
        embedTitle: "abc",
        embedDescription: "de",
        embedAuthorName: "f",
        embedFooterText: "gh",
        embedFields: [
          { name: "ij", value: "klm" },
          { name: "n", value: "o" },
        ],
      }),
    ).toBe(3 + 2 + 1 + 2 + (2 + 3) + (1 + 1));
  });

  test("treats null parts as zero", () => {
    expect(
      embedTotalLength({
        embedTitle: null,
        embedDescription: null,
        embedAuthorName: null,
        embedFooterText: null,
        embedFields: [],
      }),
    ).toBe(0);
  });
});

const baseDraftInput = {
  embedTitle: null,
  embedDescription: null,
  embedColor: null,
  embedUrl: null,
  embedThumbnail: null,
  embedImage: null,
  embedAuthorName: null,
  embedAuthorIconUrl: null,
  embedAuthorUrl: null,
  embedFooterText: null,
  embedFooterIconUrl: null,
  embedFields: [],
};

describe("EmbedDraftInputSchema", () => {
  test("accepts an empty draft", () => {
    expect(EmbedDraftInputSchema.safeParse(baseDraftInput).success).toBe(true);
  });

  test("rejects a draft over the combined character limit", () => {
    const result = EmbedDraftInputSchema.safeParse({
      ...baseDraftInput,
      embedTitle: "a".repeat(200),
      embedDescription: "b".repeat(4000),
      embedFooterText: "c".repeat(2000),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes(String(EMBED_LIMITS.total))),
      ).toBe(true);
    }
  });

  test("rejects an over-length field value", () => {
    const result = EmbedDraftInputSchema.safeParse({
      ...baseDraftInput,
      embedFields: [{ name: "ok", value: "x".repeat(EMBED_LIMITS.fieldValue + 1), inline: false }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a malformed url", () => {
    const result = EmbedDraftInputSchema.safeParse({ ...baseDraftInput, embedImage: "not-a-url" });
    expect(result.success).toBe(false);
  });

  test("rejects a color outside 0..0xffffff", () => {
    expect(
      EmbedDraftInputSchema.safeParse({ ...baseDraftInput, embedColor: 0x1000000 }).success,
    ).toBe(false);
  });

  test("coerces blank author name to null", () => {
    const result = EmbedDraftInputSchema.safeParse({ ...baseDraftInput, embedAuthorName: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.embedAuthorName).toBeNull();
  });
});

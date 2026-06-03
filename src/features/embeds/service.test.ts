import { describe, expect, it } from "bun:test";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { buildEmbed } from "./service";

const BASE_GUILD = { id: "111", name: "Test Guild", memberCount: 42 };
const BASE_CHANNEL = { id: "222", name: "general" };

function makeConfig(overrides: Partial<EmbedConfig> = {}): EmbedConfig {
  return {
    _id: "111:test",
    guildId: "111",
    name: "test",
    createdBy: "999",
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
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("buildEmbed", () => {
  it("static only — applies title, description, color, author, footer, fields", async () => {
    const config = makeConfig({
      embedTitle: "Hello World",
      embedDescription: "A test description",
      embedColor: 0xff0000,
      embedAuthorName: "Author",
      embedAuthorIconUrl: "https://example.com/icon.png",
      embedAuthorUrl: "https://example.com",
      embedFooterText: "Footer text",
      embedFooterIconUrl: "https://example.com/footer.png",
      embedFields: [{ name: "Field 1", value: "Value 1", inline: false }],
    });

    const embed = await buildEmbed(config, BASE_CHANNEL, BASE_GUILD);
    const json = embed.toJSON();

    expect(json.title).toBe("Hello World");
    expect(json.description).toBe("A test description");
    expect(json.color).toBe(0xff0000);
    expect(json.author).toEqual({
      name: "Author",
      icon_url: "https://example.com/icon.png",
      url: "https://example.com",
    });
    expect(json.footer).toEqual({
      text: "Footer text",
      icon_url: "https://example.com/footer.png",
    });
    expect(json.fields).toHaveLength(1);
    expect(json.fields?.[0]).toMatchObject({ name: "Field 1", value: "Value 1" });
  });

  it("script overrides title — dynamic title replaces static", async () => {
    const config = makeConfig({
      embedTitle: "static",
      scriptEnabled: true,
      script: "return { title: 'dynamic' };",
    });

    const embed = await buildEmbed(config, BASE_CHANNEL, BASE_GUILD);
    const json = embed.toJSON();

    expect(json.title).toBe("dynamic");
  });

  it("script appends fields — 1 static + 2 from script = 3 total", async () => {
    const config = makeConfig({
      embedFields: [{ name: "Static", value: "Field", inline: false }],
      scriptEnabled: true,
      script:
        "return { fields: [{ name: 'Script A', value: 'Val A' }, { name: 'Script B', value: 'Val B' }] };",
    });

    const embed = await buildEmbed(config, BASE_CHANNEL, BASE_GUILD);
    const json = embed.toJSON();

    expect(json.fields).toHaveLength(3);
    expect(json.fields?.[0]).toMatchObject({ name: "Static" });
    expect(json.fields?.[1]).toMatchObject({ name: "Script A" });
    expect(json.fields?.[2]).toMatchObject({ name: "Script B" });
  });

  it("script caps at 25 — 23 static + 5 script = 25 total", async () => {
    const staticFields = Array.from({ length: 23 }, (_, i) => ({
      name: `Static ${i + 1}`,
      value: `Value ${i + 1}`,
      inline: false,
    }));

    const config = makeConfig({
      embedFields: staticFields,
      scriptEnabled: true,
      script:
        "return { fields: [{ name: 'S1', value: 'V1' }, { name: 'S2', value: 'V2' }, { name: 'S3', value: 'V3' }, { name: 'S4', value: 'V4' }, { name: 'S5', value: 'V5' }] };",
    });

    const embed = await buildEmbed(config, BASE_CHANNEL, BASE_GUILD);
    const json = embed.toJSON();

    expect(json.fields).toHaveLength(25);
  });

  it("script error is silently skipped — static config still applied", async () => {
    const config = makeConfig({
      embedTitle: "static",
      scriptEnabled: true,
      script: 'throw new Error("boom");',
    });

    const embed = await buildEmbed(config, BASE_CHANNEL, BASE_GUILD);
    const json = embed.toJSON();

    expect(json.title).toBe("static");
  });

  it("script disabled — script is not run even if provided", async () => {
    const config = makeConfig({
      embedTitle: "static",
      scriptEnabled: false,
      // Script sets a different title; if run it would override "static"
      script: "return { title: 'should not appear' };",
    });

    const embed = await buildEmbed(config, BASE_CHANNEL, BASE_GUILD);
    const json = embed.toJSON();

    expect(json.title).toBe("static");
  });
});

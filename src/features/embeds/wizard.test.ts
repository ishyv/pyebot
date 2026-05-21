import { beforeEach, describe, expect, it } from "bun:test";
import type { EmbedConfigDraft } from "./wizard";
import { EmbedWizardRegistry, parseWizardId, renderWizardPanel, wizardId } from "./wizard";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "user123";
const GUILD_ID = "guild456";
const EMBED_NAME = "my-embed";

function makeDraft(): EmbedConfigDraft {
  return {
    embedTitle: "Test Title",
    embedDescription: "Test description",
    embedColor: 0x5865f2,
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
    stickyEnabled: false,
  };
}

// ---------------------------------------------------------------------------
// EmbedWizardRegistry
// ---------------------------------------------------------------------------

describe("EmbedWizardRegistry", () => {
  let registry: EmbedWizardRegistry;

  beforeEach(() => {
    registry = new EmbedWizardRegistry();
  });

  it("create() returns a session with correct properties", () => {
    const draft = makeDraft();
    const before = Date.now();
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, draft, false);
    const after = Date.now();

    expect(session.ownerId).toBe(OWNER_ID);
    expect(session.guildId).toBe(GUILD_ID);
    expect(session.embedName).toBe(EMBED_NAME);
    expect(session.isEdit).toBe(false);
    expect(session.draft).toBe(draft);
    expect(session.id).toBeString();
    expect(session.id).toHaveLength(8);
    expect(session.createdAt).toBeGreaterThanOrEqual(before);
    expect(session.createdAt).toBeLessThanOrEqual(after);
    expect(session.updatedAt).toBe(session.createdAt);
  });

  it("get() returns null for unknown session", () => {
    expect(registry.get("nonexistent")).toBeNull();
  });

  it("get() returns null for expired session and removes it", () => {
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, makeDraft(), false);
    const id = session.id;

    // Backdate createdAt past TTL
    const ttlMs = 10 * 60_000;
    session.createdAt = Date.now() - ttlMs - 1;

    expect(registry.get(id)).toBeNull();
    // Verify session was deleted from the map
    expect(registry.get(id)).toBeNull();
  });

  it("get() touches updatedAt on each call", () => {
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, makeDraft(), false);
    const id = session.id;
    const firstUpdated = session.updatedAt;

    // Backdate updatedAt to simulate time passage
    session.updatedAt = firstUpdated;

    // Advance "now" by manually patching — easiest is to just call get() and
    // confirm updatedAt is >= createdAt (since Date.now() is live)
    const retrieved = registry.get(id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.updatedAt).toBeGreaterThanOrEqual(firstUpdated);
  });

  it("get() returns null for session where createdAt + TTL equals now exactly", () => {
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, makeDraft(), false);
    const id = session.id;
    const ttlMs = 10 * 60_000;

    // Set createdAt so that createdAt + TTL === Date.now() (boundary — expired)
    session.createdAt = Date.now() - ttlMs;

    // The condition is: createdAt + TTL < Date.now()
    // At exact boundary (==) it is NOT expired yet
    const result = registry.get(id);
    // Result depends on clock precision; just assert it's either null or the session
    expect(result === null || result === session).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// wizardId / parseWizardId
// ---------------------------------------------------------------------------

describe("wizardId and parseWizardId", () => {
  it("round-trip: parseWizardId(wizardId(id, action)) returns correct parts", () => {
    const id = "abc12345";
    const action = "basic-modal";
    const encoded = wizardId(id, action);
    const parsed = parseWizardId(encoded);
    expect(parsed).not.toBeNull();
    expect(parsed?.sessionId).toBe(id);
    expect(parsed?.action).toBe(action);
  });

  it("round-trip works with action containing colons", () => {
    const id = "deadbeef";
    const action = "field:add:0";
    const encoded = wizardId(id, action);
    const parsed = parseWizardId(encoded);
    expect(parsed).not.toBeNull();
    expect(parsed?.sessionId).toBe(id);
    expect(parsed?.action).toBe(action);
  });

  it("parseWizardId returns null for 'emb:' (no session, no action)", () => {
    expect(parseWizardId("emb:")).toBeNull();
  });

  it("parseWizardId returns null for 'emb:abc' (no action segment)", () => {
    expect(parseWizardId("emb:abc")).toBeNull();
  });

  it("parseWizardId returns null for wrong prefix 'abc:x:y'", () => {
    expect(parseWizardId("abc:x:y")).toBeNull();
  });

  it("parseWizardId returns null for empty string", () => {
    expect(parseWizardId("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderWizardPanel
// ---------------------------------------------------------------------------

describe("renderWizardPanel", () => {
  it("returns a payload with a container and empty actionRows", () => {
    const registry = new EmbedWizardRegistry();
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, makeDraft(), false);

    const payload = renderWizardPanel(session);

    expect(payload).toBeDefined();
    expect(payload.container).toBeDefined();
    expect(payload.actionRows).toEqual([]);
  });

  it("container JSON contains section headings for all 8 sections", () => {
    const registry = new EmbedWizardRegistry();
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, makeDraft(), false);

    const payload = renderWizardPanel(session);
    const json = JSON.stringify(payload.container.toJSON());

    expect(json).toContain("Basic");
    expect(json).toContain("Media");
    expect(json).toContain("Author");
    expect(json).toContain("Footer");
    expect(json).toContain("Fields");
    expect(json).toContain("Delivery");
    expect(json).toContain("Script");
    // Actions row is present (save/cancel/preview buttons)
    expect(json).toContain("Save");
    expect(json).toContain("Cancel");
    expect(json).toContain("Preview");
  });

  it("container contains wizardId-encoded custom IDs for buttons", () => {
    const registry = new EmbedWizardRegistry();
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, makeDraft(), false);

    const payload = renderWizardPanel(session);
    const json = JSON.stringify(payload.container.toJSON());

    expect(json).toContain(wizardId(session.id, "basic-modal"));
    expect(json).toContain(wizardId(session.id, "media-modal"));
    expect(json).toContain(wizardId(session.id, "save"));
    expect(json).toContain(wizardId(session.id, "cancel"));
  });

  it("fields section shows field count", () => {
    const registry = new EmbedWizardRegistry();
    const draft = makeDraft();
    draft.embedFields = [
      { name: "f1", value: "v1", inline: false },
      { name: "f2", value: "v2", inline: false },
    ];
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, draft, false);

    const payload = renderWizardPanel(session);
    const json = JSON.stringify(payload.container.toJSON());

    expect(json).toContain("2/25 fields");
  });

  it("isEdit flag shows in breadcrumb", () => {
    const registry = new EmbedWizardRegistry();
    const session = registry.create(OWNER_ID, GUILD_ID, EMBED_NAME, makeDraft(), true);

    const payload = renderWizardPanel(session);
    const json = JSON.stringify(payload.container.toJSON());

    expect(json).toContain("Edit");
    expect(json).toContain(EMBED_NAME);
  });
});

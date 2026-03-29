import { describe, expect, test, mock } from "bun:test";
import { z } from "zod";

// We test MongoStore's parse/default behavior by using a minimal schema
// DB integration tests require MONGO_URI

const TestSchema = z.object({
  _id: z.string(),
  name: z.string().catch("default_name"),
  count: z.number().int().catch(0),
});
type TestDoc = z.infer<typeof TestSchema>;

describe("MongoStore (unit — schema behavior)", () => {
  test("schema applies defaults for missing fields", () => {
    const parsed = TestSchema.safeParse({ _id: "test" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("default_name");
      expect(parsed.data.count).toBe(0);
    }
  });

  test("schema uses catch defaults for invalid data", () => {
    const parsed = TestSchema.safeParse({ _id: "test", name: 42, count: "bad" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("default_name");
      expect(parsed.data.count).toBe(0);
    }
  });

  test("schema preserves valid data", () => {
    const parsed = TestSchema.safeParse({ _id: "x", name: "Alice", count: 5 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Alice");
      expect(parsed.data.count).toBe(5);
    }
  });
});

// Integration tests (skipped without DB)
describe("MongoStore (integration)", () => {
  if (!process.env.MONGO_URI) {
    test.skip("requires MONGO_URI", () => {});
    return;
  }

  test("get returns null for nonexistent document", async () => {
    const { MongoStore } = await import("./store");
    const store = new MongoStore("__test_store", TestSchema);
    const result = await store.get("nonexistent_id_xyz");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeNull();
  });

  test("ensure creates document with defaults", async () => {
    const { MongoStore } = await import("./store");
    const { disconnectDb } = await import("../core/db");
    const store = new MongoStore("__test_store", TestSchema);
    const id = `test_${Date.now()}`;
    const result = await store.ensure(id);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap()._id).toBe(id);
      expect(result.unwrap().name).toBe("default_name");
    }
    await store.delete(id);
    await disconnectDb();
  });
});

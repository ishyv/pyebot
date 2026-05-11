import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStorageAdapter, MemoryStorageAdapter, type StorageAdapter } from "@/framework/storage";

describe("storage adapters", () => {
  test("memory storage stores, patches, lists, and deletes documents", async () => {
    await assertStorageConformance(new MemoryStorageAdapter());
  });

  test("file storage persists documents across adapter instances", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tx-v2-storage-"));
    try {
      const first = new FileStorageAdapter(dir);
      await assertStorageConformance(first);

      const second = new FileStorageAdapter(dir);
      await second.connect();
      expect(
        await second.collection<{ readonly _id: string; readonly value: number }>("items").get("a"),
      ).toEqual({
        _id: "a",
        value: 2,
      });
      await second.disconnect();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

async function assertStorageConformance(adapter: StorageAdapter): Promise<void> {
  await adapter.connect?.();
  const collection = adapter.collection<{
    readonly _id: string;
    readonly value: number;
    readonly label?: string;
  }>("items");

  await collection.set("a", { _id: "a", value: 1 });
  await collection.patch("a", { value: 2 });
  await collection.set("b", { _id: "b", value: 3, label: "bee" });

  expect(await collection.get("a")).toEqual({ _id: "a", value: 2 });
  expect(await collection.all()).toEqual([
    { _id: "a", value: 2 },
    { _id: "b", value: 3, label: "bee" },
  ]);

  await collection.delete("b");
  expect(await collection.get("b")).toBeNull();
  await adapter.disconnect?.();
}

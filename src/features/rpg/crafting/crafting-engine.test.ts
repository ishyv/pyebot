import { describe, expect, test } from "bun:test";
import { loadContentRegistry, resetContentRegistryForTests } from "@/content/registry";
import { craftItems } from "./crafting-engine";

describe("craftItems", () => {
  test("fails clearly when content registry is not loaded", async () => {
    resetContentRegistryForTests();

    const result = await craftItems("user-1", ["stone"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("ENGINE_ERROR");
      expect(result.error.message).toBe("Content registry is not loaded.");
    }
  });

  test("uses the typed content registry for deterministic recipes", async () => {
    await loadContentRegistry({ forceReload: true });

    const result = await craftItems("user-1", ["stone"]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.outputId).toBe("sharp_stone");
      expect(result.value.method).toBe("transform");
    }
  });
});

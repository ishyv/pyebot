import { describe, expect, test, vi } from "vitest";

// enhanceSave imports toastStore from the library; stub it so the wiring test
// runs without a DOM. The factory must be self-contained (vi.mock is hoisted).
vi.mock("@hyvnt/hyvui", () => ({ toastStore: { push: () => {} } }));

import { enhanceSave, type FieldError, interpretSaveResult, isDirty } from "./forms";

describe("interpretSaveResult", () => {
  test("maps a success to the ok message", () => {
    expect(interpretSaveResult({ type: "success" }, "daily saved")).toEqual({
      ok: true,
      message: "daily saved",
    });
  });

  test("surfaces the server error and field on failure", () => {
    expect(
      interpretSaveResult(
        {
          type: "failure",
          data: { error: "cooldownHours must be at least 1.", field: "cooldownHours" },
        },
        "saved",
      ),
    ).toEqual({ ok: false, message: "cooldownHours must be at least 1.", field: "cooldownHours" });
  });

  test("falls back to a generic message when the payload has no error", () => {
    expect(interpretSaveResult({ type: "failure", data: {} }, "saved")).toEqual({
      ok: false,
      message: "save failed, retry",
      field: undefined,
    });
  });
});

describe("isDirty", () => {
  test("false when every key matches the snapshot", () => {
    expect(isDirty({ a: "1", b: "2" }, { a: "1", b: "2" })).toBe(false);
  });

  test("true when any key diverges", () => {
    expect(isDirty({ a: "1", b: "9" }, { a: "1", b: "2" })).toBe(true);
  });
});

describe("enhanceSave", () => {
  test("flips saving, clears error, and flashes ok on success", async () => {
    const saving: boolean[] = [];
    let error: FieldError | null = { field: "x", message: "stale" };
    const triggered: string[] = [];
    let updated = false;

    const submit = enhanceSave({
      setSaving: (v) => saving.push(v),
      okMessage: "saved",
      resolve: () => ({ trigger: (s) => triggered.push(s) }),
      setError: (e) => {
        error = e;
      },
    }) as unknown as () => (cb: {
      result: { type: string; data?: unknown };
      update: () => Promise<void>;
    }) => Promise<void>;

    const after = submit();
    await after({
      result: { type: "success" },
      update: async () => {
        updated = true;
      },
    });

    expect(saving).toEqual([true, false]);
    expect(error).toBeNull();
    expect(triggered).toEqual(["ok"]);
    expect(updated).toBe(true);
  });

  test("reports the field error and flashes fail on failure", async () => {
    let error: FieldError | null = null;
    const triggered: string[] = [];

    const submit = enhanceSave({
      setSaving: () => {},
      okMessage: "saved",
      resolve: () => ({ trigger: (s) => triggered.push(s) }),
      setError: (e) => {
        error = e;
      },
    }) as unknown as () => (cb: {
      result: { type: string; data?: unknown };
      update: () => Promise<void>;
    }) => Promise<void>;

    await submit()({
      result: { type: "failure", data: { error: "reward must be numeric.", field: "reward" } },
      update: async () => {},
    });

    expect(error).toEqual({ field: "reward", message: "reward must be numeric." });
    expect(triggered).toEqual(["fail"]);
  });
});

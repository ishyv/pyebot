import { describe, expect, test } from "bun:test";
import { atomicTransition } from "./transition";
import { OkResult, ErrResult } from "@/core/result";

describe("atomicTransition", () => {
  test("succeeds on first attempt when commit succeeds", async () => {
    let committed = false;
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => OkResult({ value: 10 }),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u.value,
      computeNext: (snapshot) => OkResult(snapshot + 5),
      commit: async (_expected, next) => {
        committed = true;
        return OkResult({ value: next });
      },
      project: (_user, next) => next,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(15);
    expect(committed).toBe(true);
  });

  test("retries when commit returns null (CAS conflict)", async () => {
    let attempts = 0;
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => OkResult({ value: 0 }),
      getFresh: async (u) => OkResult({ value: u.value + 1 }),
      getSnapshot: (u) => u.value,
      computeNext: (snapshot) => OkResult(snapshot + 10),
      commit: async (_expected, _next) => {
        attempts++;
        if (attempts < 3) return OkResult(null); // simulate CAS miss
        return OkResult({ value: _next });
      },
      project: (_user, next) => next,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isOk()).toBe(true);
    expect(attempts).toBe(3);
  });

  test("calls onExhausted when all attempts fail", async () => {
    const result = await atomicTransition({
      attempts: 2,
      getInitial: async () => OkResult({ value: 0 }),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u.value,
      computeNext: (snapshot) => OkResult(snapshot),
      commit: async () => OkResult(null), // always fails
      project: (_u, next) => next,
      onExhausted: () => ErrResult(new Error("gave up")),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("gave up");
  });

  test("propagates error from getInitial", async () => {
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => ErrResult(new Error("db down")),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u,
      computeNext: (s) => OkResult(s),
      commit: async () => OkResult(null),
      project: (u) => u,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("db down");
  });

  test("propagates error from computeNext", async () => {
    const result = await atomicTransition({
      attempts: 3,
      getInitial: async () => OkResult({ value: 0 }),
      getFresh: async (u) => OkResult(u),
      getSnapshot: (u) => u.value,
      computeNext: () => ErrResult(new Error("compute failed")),
      commit: async () => OkResult(null),
      project: (_u, next) => next,
      onExhausted: () => ErrResult(new Error("exhausted")),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("compute failed");
  });
});

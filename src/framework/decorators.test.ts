/**
 * Tests for @On and @Handle. Verifies metadata is correctly attached to
 * the class prototype and readable via the framework getters.
 */

import { describe, expect, it } from "bun:test";
import { getHandleMetadata, getOnMetadata, Handle, On } from "./decorators";

class FakeEvent {}

class Sample {
  @On(FakeEvent)
  async onFake(): Promise<void> {}

  @Handle("foo:")
  async onFoo(): Promise<void> {}

  @Handle("bar:")
  async onBar(): Promise<void> {}
}

describe("decorators", () => {
  it("@On records the event class and method name", () => {
    const meta = getOnMetadata(new Sample());
    expect(meta.length).toBe(1);
    expect(meta[0]!.event).toBe(FakeEvent);
    expect(meta[0]!.methodKey).toBe("onFake");
  });

  it("@Handle records the prefix and method name", () => {
    const meta = getHandleMetadata(new Sample());
    expect(meta.length).toBe(2);
    const prefixes = meta.map((m) => m.prefix).sort();
    expect(prefixes).toEqual(["bar:", "foo:"]);
  });
});

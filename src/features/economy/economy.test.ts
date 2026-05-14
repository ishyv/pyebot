/**
 * Tests for economy account module.
 * `ensureAccount` delegates to ctx.ensure — only `isAccountActive` has logic worth testing.
 */

import { describe, expect, it } from "bun:test";
import { isAccountActive } from "./account";

describe("isAccountActive", () => {
  it('returns true for "ok"', () => {
    expect(isAccountActive("ok")).toBe(true);
  });

  it('returns false for "blocked"', () => {
    expect(isAccountActive("blocked")).toBe(false);
  });

  it('returns false for "banned"', () => {
    expect(isAccountActive("banned")).toBe(false);
  });

  it("returns false for unknown status", () => {
    expect(isAccountActive("suspended")).toBe(false);
  });
});

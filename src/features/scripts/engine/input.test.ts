import { describe, expect, it } from "bun:test";
import { scanInputs } from "./input";

describe("scanInputs", () => {
  it("detects a single input.text call with double quotes", () => {
    expect(scanInputs('input.text("role", "Role to check")')).toEqual([
      { name: "role", label: "Role to check", required: true, placeholder: "" },
    ]);
  });

  it("detects single-quoted and backtick-quoted calls", () => {
    expect(scanInputs("input.text('name', 'Your name')")).toHaveLength(1);
    expect(scanInputs("input.text(`key`, `Enter key`)")).toHaveLength(1);
  });

  it("detects multiple inputs in declaration order", () => {
    const src = `
      input.text("role", "Role to check");
      input.text("limit", "Max results");
    `;
    const fields = scanInputs(src);
    expect(fields.map((f) => f.name)).toEqual(["role", "limit"]);
  });

  it("de-dupes duplicate names (first occurrence wins)", () => {
    const src = 'input.text("role","A"); input.text("role","B");';
    expect(scanInputs(src)).toHaveLength(1);
    expect(scanInputs(src)[0].label).toBe("A");
  });

  it("returns empty array when no inputs are declared", () => {
    expect(scanInputs("return ctx.members.length;")).toEqual([]);
  });

  it("ignores dynamic calls that can't be statically detected", () => {
    // Variable arguments — can't extract reliably
    expect(scanInputs("const n = 'role'; input.text(n, 'Label');")).toEqual([]);
  });
});

import { describe, expect, it } from "bun:test";
import { asInputError, fail_input, scanInputs, validateInputValues } from "./input";

describe("scanInputs", () => {
  it("detects a typed input with double quotes", () => {
    expect(scanInputs('input.text("role", "Role to check")')).toEqual([
      { name: "role", type: "text", label: "Role to check", required: true, placeholder: "" },
    ]);
  });

  it("captures the type for each input method", () => {
    const src = `
      input.text("a", "A");
      input.number("b", "B");
      input.role("c", "C");
      input.member("d", "D");
      input.channel("e", "E");
    `;
    expect(scanInputs(src).map((f) => [f.name, f.type])).toEqual([
      ["a", "text"],
      ["b", "number"],
      ["c", "role"],
      ["d", "member"],
      ["e", "channel"],
    ]);
  });

  it("detects single-quoted and backtick-quoted calls", () => {
    expect(scanInputs("input.text('name', 'Your name')")).toHaveLength(1);
    expect(scanInputs("input.role(`key`, `Pick`)")).toHaveLength(1);
  });

  it("de-dupes duplicate names (first occurrence wins)", () => {
    const src = 'input.text("role","A"); input.role("role","B");';
    expect(scanInputs(src)).toHaveLength(1);
    expect(scanInputs(src)[0].label).toBe("A");
  });

  it("skips names that aren't safe identifiers", () => {
    expect(scanInputs('input.text("has-dash", "X")')).toEqual([]);
    expect(scanInputs('input.text("1bad", "X")')).toEqual([]);
  });

  it("returns empty array when no inputs are declared", () => {
    expect(scanInputs("return ctx.members.length;")).toEqual([]);
  });

  it("ignores dynamic calls that can't be statically detected", () => {
    expect(scanInputs("const n = 'role'; input.text(n, 'Label');")).toEqual([]);
  });
});

describe("validateInputValues", () => {
  const fields = scanInputs('input.text("name","Name"); input.number("age","Age");');

  it("flags a missing required value", () => {
    expect(validateInputValues(fields, { age: "5" })).toMatch(/Name/);
  });

  it("flags a malformed number", () => {
    expect(validateInputValues(fields, { name: "x", age: "abc" })).toMatch(/number/);
  });

  it("passes when all required values are present and valid", () => {
    expect(validateInputValues(fields, { name: "x", age: "5" })).toBeNull();
  });

  it("allows an empty optional field", () => {
    const optional = [
      { name: "note", type: "text" as const, label: "Note", required: false, placeholder: "" },
    ];
    expect(validateInputValues(optional, {})).toBeNull();
  });
});

describe("fail_input / asInputError", () => {
  it("fail_input throws a marked error that asInputError recovers", () => {
    let caught: string | null = null;
    try {
      fail_input("pick another role");
    } catch (e) {
      caught = asInputError((e as Error).message);
    }
    expect(caught).toBe("pick another role");
  });

  it("asInputError returns null for a plain error", () => {
    expect(asInputError("some runtime crash")).toBeNull();
  });
});

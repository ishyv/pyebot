import { describe, expect, it } from "bun:test";
import { createRoleRecord, formatLimit, parseLimitWindow } from "./rolePolicy";

describe("role policy helpers", () => {
  it("parses supported limit windows", () => {
    expect(parseLimitWindow("10m")).toEqual({ ok: true, value: "10m", seconds: 600 });
    expect(parseLimitWindow("1h")).toEqual({ ok: true, value: "1h", seconds: 3600 });
    expect(parseLimitWindow("7d")).toEqual({ ok: true, value: "7d", seconds: 604800 });
  });

  it("treats empty and zero windows as no fixed window", () => {
    expect(parseLimitWindow("")).toEqual({ ok: true, value: null, seconds: null });
    expect(parseLimitWindow("0h")).toEqual({ ok: true, value: null, seconds: null });
  });

  it("rejects invalid windows", () => {
    expect(parseLimitWindow("15x").ok).toBe(false);
  });

  it("creates managed role records with empty policy maps", () => {
    const record = createRoleRecord("role-1", "Mods", "user-1");

    expect(record.discordRoleId).toBe("role-1");
    expect(record.label).toBe("Mods");
    expect(record.reach).toEqual({});
    expect(record.limits).toEqual({});
  });

  it("formats missing limits clearly", () => {
    expect(formatLimit(undefined)).toBe("No limit");
  });
});


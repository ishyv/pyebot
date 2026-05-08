import { describe, expect, test } from "bun:test";
import tickets from "@/features/tickets";

describe("tickets feature module", () => {
  test("is exported through the decorator compiler", () => {
    expect(tickets.id).toBe("tickets");
    expect(tickets.featureGate).toBe("tickets");
    expect(tickets.commands.map((command) => command.data.name)).toEqual(["ticket"]);
    expect(tickets.components?.[0]?.matches("tickets:close:123")).toBe(true);
  });
});

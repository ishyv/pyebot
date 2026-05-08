import { describe, expect, it } from "bun:test";
import { evaluateIntegerExpression } from "./expression";

describe("evaluateIntegerExpression", () => {
  it("evaluates safe arithmetic expressions", () => {
    expect(evaluateIntegerExpression("1-1").unwrap()).toBe(0);
    expect(evaluateIntegerExpression("2/2").unwrap()).toBe(1);
    expect(evaluateIntegerExpression("(2 + 3) * 4").unwrap()).toBe(20);
  });

  it("rejects unsafe or invalid expressions", () => {
    expect(evaluateIntegerExpression("process.exit()").isErr()).toBe(true);
    expect(evaluateIntegerExpression("1 + 1 nope").isErr()).toBe(true);
    expect(evaluateIntegerExpression("1 / 0").isErr()).toBe(true);
    expect(evaluateIntegerExpression("1 / 2").isErr()).toBe(true);
    expect(evaluateIntegerExpression("9007199254740991 + 1").isErr()).toBe(true);
  });
});

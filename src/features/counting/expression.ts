/**
 * Tiny integer arithmetic parser for counting messages.
 *
 * Counting accepts simple expressions so users can post "40 + 2" instead of
 * only raw numbers. The grammar is intentionally small: integers, whitespace,
 * unary +/-, parentheses, and + - * /. Results must be safe integers so a
 * public message cannot produce Infinity, NaN, or precision-surprising values.
 */
import { ErrResult, OkResult, type Result } from "@/core/result";

export type ExpressionErrorCode =
  | "too_long"
  | "unexpected_character"
  | "unexpected_end"
  | "division_by_zero"
  | "unsafe_result"
  | "trailing_input";

export interface ExpressionError {
  readonly code: ExpressionErrorCode;
  readonly message: string;
  readonly position: number;
}

const MAX_EXPRESSION_LENGTH = 80;

export function evaluateIntegerExpression(input: string): Result<number, ExpressionError> {
  if (input.length > MAX_EXPRESSION_LENGTH) {
    return ErrResult({ code: "too_long", message: "Expression is too long.", position: MAX_EXPRESSION_LENGTH });
  }

  const parser = new ArithmeticParser(input);
  const result = parser.parse();
  if (result.isErr()) return result;

  const value = result.unwrap();
  if (!Number.isSafeInteger(value)) {
    return ErrResult({ code: "unsafe_result", message: "Expression result must be a safe integer.", position: input.length });
  }

  return OkResult(value);
}

class ArithmeticParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse(): Result<number, ExpressionError> {
    const value = this.parseExpression();
    if (value.isErr()) return value;

    this.skipWhitespace();
    if (!this.isAtEnd()) {
      return this.error("trailing_input", "Expression has trailing input.");
    }
    return value;
  }

  private parseExpression(): Result<number, ExpressionError> {
    const first = this.parseTerm();
    if (first.isErr()) return first;

    let left = first.unwrap();
    while (true) {
      this.skipWhitespace();
      const operator = this.peek();
      if (operator !== "+" && operator !== "-") return OkResult(left);

      this.index += 1;
      const right = this.parseTerm();
      if (right.isErr()) return right;
      left = operator === "+" ? left + right.unwrap() : left - right.unwrap();
    }
  }

  private parseTerm(): Result<number, ExpressionError> {
    const first = this.parseFactor();
    if (first.isErr()) return first;

    let left = first.unwrap();
    while (true) {
      this.skipWhitespace();
      const operator = this.peek();
      if (operator !== "*" && operator !== "/") return OkResult(left);

      this.index += 1;
      const right = this.parseFactor();
      if (right.isErr()) return right;

      const rightValue = right.unwrap();
      if (operator === "/" && rightValue === 0) {
        return this.error("division_by_zero", "Cannot divide by zero.");
      }
      left = operator === "*" ? left * rightValue : left / rightValue;
    }
  }

  private parseFactor(): Result<number, ExpressionError> {
    this.skipWhitespace();
    const current = this.peek();

    if (current === "+" || current === "-") {
      this.index += 1;
      const value = this.parseFactor();
      if (value.isErr()) return value;
      return OkResult(current === "-" ? -value.unwrap() : value.unwrap());
    }

    if (current === "(") {
      this.index += 1;
      const value = this.parseExpression();
      if (value.isErr()) return value;

      this.skipWhitespace();
      if (this.peek() !== ")") {
        return this.error("unexpected_end", "Expected closing parenthesis.");
      }
      this.index += 1;
      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): Result<number, ExpressionError> {
    this.skipWhitespace();
    const start = this.index;

    while (this.isDigit(this.peek())) this.index += 1;

    if (start === this.index) {
      return this.isAtEnd()
        ? this.error("unexpected_end", "Expected a number.")
        : this.error("unexpected_character", "Expected a number or parenthesis.");
    }

    return OkResult(Number(this.input.slice(start, this.index)));
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) this.index += 1;
  }

  private peek(): string {
    return this.input[this.index] ?? "";
  }

  private isAtEnd(): boolean {
    return this.index >= this.input.length;
  }

  private isDigit(value: string): boolean {
    return value >= "0" && value <= "9";
  }

  private error(code: ExpressionErrorCode, message: string): Result<never, ExpressionError> {
    return ErrResult({ code, message, position: this.index });
  }
}

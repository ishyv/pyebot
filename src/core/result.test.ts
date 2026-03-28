import { describe, expect, test } from "bun:test";
import { Ok, Err, OkResult, ErrResult } from "./result";

describe("Ok", () => {
  test("isOk returns true", () => {
    expect(new Ok(42).isOk()).toBe(true);
  });

  test("isErr returns false", () => {
    expect(new Ok(42).isErr()).toBe(false);
  });

  test("unwrap returns value", () => {
    expect(new Ok("hello").unwrap()).toBe("hello");
  });

  test("unwrapOr returns value (ignores default)", () => {
    expect(new Ok(42).unwrapOr(0)).toBe(42);
  });

  test("map transforms value", () => {
    const result = new Ok(2).map((x) => x * 3);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(6);
  });

  test("mapErr is a no-op on Ok", () => {
    const result = new Ok<number, Error>(5).mapErr(() => new Error("x"));
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(5);
  });

  test("inspect calls fn with value", () => {
    let called = false;
    new Ok(1).inspect(() => { called = true; });
    expect(called).toBe(true);
  });

  test("inspectErr does not call fn on Ok", () => {
    let called = false;
    new Ok(1).inspectErr(() => { called = true; });
    expect(called).toBe(false);
  });
});

describe("Err", () => {
  test("isOk returns false", () => {
    expect(new Err(new Error("fail")).isOk()).toBe(false);
  });

  test("isErr returns true", () => {
    expect(new Err(new Error("fail")).isErr()).toBe(true);
  });

  test("unwrap returns undefined and does not throw", () => {
    const result = new Err<number, Error>(new Error("oops")).unwrap();
    expect(result).toBeUndefined();
  });

  test("unwrapOr returns default value", () => {
    expect(new Err<number, Error>(new Error()).unwrapOr(99)).toBe(99);
  });

  test("map is a no-op on Err", () => {
    const result = new Err<number, Error>(new Error("x")).map((x) => x * 2);
    expect(result.isErr()).toBe(true);
  });

  test("mapErr transforms error", () => {
    const result = new Err<number, string>("bad").mapErr((e) => new Error(e));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("bad");
  });

  test("inspect does not call fn on Err", () => {
    let called = false;
    new Err<number, Error>(new Error()).inspect(() => { called = true; });
    expect(called).toBe(false);
  });

  test("inspectErr calls fn with error", () => {
    let called = false;
    new Err(new Error("x")).inspectErr(() => { called = true; });
    expect(called).toBe(true);
  });
});

describe("OkResult / ErrResult factories", () => {
  test("OkResult creates Ok", () => {
    expect(OkResult(42).isOk()).toBe(true);
  });

  test("ErrResult creates Err", () => {
    expect(ErrResult(new Error()).isErr()).toBe(true);
  });
});

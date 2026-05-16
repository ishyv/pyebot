import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createLogger } from "./logger";

describe("createLogger", () => {
  beforeEach(() => {
    // Restore any spies from previous tests
    mock.restore();
  });

  test("returns an object with info, warn, error, debug", () => {
    const logger = createLogger("test");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  test("info calls console.log with context prefix", () => {
    const spy = mock(() => {});
    const orig = console.log;
    console.log = spy;
    const logger = createLogger("MyCtx");
    logger.info("hello");
    console.log = orig;
    expect(spy).toHaveBeenCalledTimes(1);
    const call = (spy.mock.calls[0] as string[])[0] as string;
    expect(call).toContain("[MyCtx]");
    expect(call).toContain("hello");
  });

  test("debug does not log when DEBUG env is not set", () => {
    const orig = process.env.DEBUG;
    delete process.env.DEBUG;
    const spy = mock(() => {});
    const origLog = console.log;
    console.log = spy;
    const logger = createLogger("test");
    logger.debug("hidden");
    console.log = origLog;
    process.env.DEBUG = orig;
    expect(spy).not.toHaveBeenCalled();
  });

  test("debug logs when DEBUG env is set", () => {
    process.env.DEBUG = "1";
    const spy = mock(() => {});
    const origLog = console.log;
    console.log = spy;
    const logger = createLogger("test");
    logger.debug("visible");
    console.log = origLog;
    delete process.env.DEBUG;
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("warn calls console.warn with context prefix", () => {
    const spy = mock(() => {});
    const orig = console.warn;
    console.warn = spy;
    const logger = createLogger("MyCtx");
    logger.warn("warning message");
    console.warn = orig;
    expect(spy).toHaveBeenCalledTimes(1);
    const call = (spy.mock.calls[0] as string[])[0] as string;
    expect(call).toContain("[MyCtx]");
    expect(call).toContain("warning message");
  });

  test("error calls console.error with context prefix", () => {
    const spy = mock(() => {});
    const orig = console.error;
    console.error = spy;
    const logger = createLogger("MyCtx");
    logger.error("error message");
    console.error = orig;
    expect(spy).toHaveBeenCalledTimes(1);
    const call = (spy.mock.calls[0] as string[])[0] as string;
    expect(call).toContain("[MyCtx]");
    expect(call).toContain("error message");
  });
});

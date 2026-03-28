import { describe, expect, test, beforeEach } from "bun:test";
import { disconnectDb, getDb } from "./db";

// Integration tests: only run when MONGO_URI is set
const MONGO_URI = process.env.MONGO_URI;

describe("db module", () => {
  test("getDb is a function", async () => {
    const { getDb: fn } = await import("./db");
    expect(typeof fn).toBe("function");
  });

  test("disconnectDb resets internal state so getDb reconnects", async () => {
    if (!MONGO_URI) return; // skip without real DB
    const db1 = await getDb();
    await disconnectDb();
    const db2 = await getDb();
    expect(db1).not.toBe(db2);
    await disconnectDb();
  });
});

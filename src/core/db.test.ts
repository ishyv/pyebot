import { describe, expect, test } from "bun:test";
import { disconnectDb, getDb } from "./db";

// Integration tests: only run when MONGO_URI is set
const MONGO_URI = process.env.MONGO_URI;

describe("db module", () => {
  test("getDb throws when MONGO_URI is not set", async () => {
    const orig = process.env.MONGO_URI;
    delete process.env.MONGO_URI;
    await expect(getDb()).rejects.toThrow("MONGO_URI");
    if (orig !== undefined) {
      process.env.MONGO_URI = orig;
    }
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

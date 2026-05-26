import { describe, expect, test } from "bun:test";
import { resetEnvCache } from "./env";

// Integration tests: only run when MONGO_URI is set
const MONGO_URI = process.env.MONGO_URI;
const dbModulePath = "./db.ts?db-module-test";

function loadDbModule(): Promise<typeof import("./db")> {
  return import(dbModulePath) as Promise<typeof import("./db")>;
}

describe("db module", () => {
  test("getDb throws when MONGO_URI is not set", async () => {
    const { getDb } = await loadDbModule();
    const orig = process.env.MONGO_URI;
    delete process.env.MONGO_URI;
    resetEnvCache(); // env is memoised; re-read after mutating process.env
    await expect(getDb()).rejects.toThrow("MONGO_URI");
    if (orig !== undefined) {
      process.env.MONGO_URI = orig;
    }
    resetEnvCache();
  });

  test("disconnectDb resets internal state so getDb reconnects", async () => {
    if (!MONGO_URI) return; // skip without real DB
    const { disconnectDb, getDb } = await loadDbModule();
    const db1 = await getDb();
    await disconnectDb();
    const db2 = await getDb();
    expect(db1).not.toBe(db2);
    await disconnectDb();
  });
});
